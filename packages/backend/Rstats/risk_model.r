################################################################################
#
##### Freifahren project
##### Risk model
##### Johann-Friedrich Salzmann
#
################################################################################

rm(list = ls(envir = globalenv()),envir = globalenv())

# Install pacman if not already installed
if (!require("pacman")) {
    install.packages("pacman", repos = "https://cloud.r-project.org/")
    library(pacman)
}

p_load(dotenv)
p_load(magrittr)
p_load(ggplot2)
p_load(tidyverse)
p_load(sf)
p_load(units)
p_load(jsonlite)
p_load(boot)
p_load(extraDistr)
p_load(dbplyr)
p_load(RPostgres)
p_load(data.table)

"%cin%" = function(x,y){str_detect(y,x)}
"%xin%" = function(x,y){x %cin% y | y %cin% x}
"%ni%" = Negate("%in%")
"%nci%" = Negate("%cin%")
"%nxi%" = Negate("%xin%")
"%.%" = function(x,y){paste(x,y,sep = "")}
cNA = as.character(NA)
nNA = as.numeric(NA)
as.numeric.factor = . %>% as.numeric(levels(.))[.]
"%?%" = function(x, y) list(x = x, y = y)
"%:%" = function(xy, z) if(xy$x) xy$y else z
pmin2_na = function(a,b) pmin(coalesce(a,b),coalesce(b,a))

# Get the environment variables
load_dot_env(".env")
DB_NAME = Sys.getenv("DB_NAME")
DB_HOST = Sys.getenv("DB_HOST")
DB_PORT = Sys.getenv("DB_PORT")
DB_USER = Sys.getenv("DB_READER")
DB_PASSWORD = Sys.getenv("DB_READER_PASSWORD")

################################################################################

FreifahrenRiskClassifier = R6::R6Class("FreifahrenRiskClassifier",
   public = list(
     segments = NULL,
     data = NULL,
     time = NULL,
     .score = NULL,
     .projection = NULL,

     initialize = function(segments, data, time, .score = "score", .projection = "color"){
       self$segments = segments
       self$data = data
       self$time = time
       self$.score = .score
       self$.projection = .projection

       self$pre_process()
       self$assess_risk()
       self$project_risk()
     },

     print = function(){
       print(self$data %>% head(12))
     },

     pre_process = function(){
       # Detect direction & position in the network
       line_ranks = self$segments %>% as_tibble() %>% select(line,stop_to,stop_from,r)

       self$data %<>% # data=exc
         filter(timestamp <= self$time) %>%
         left_join(line_ranks %>% rename(r_dir1 = r), join_by(line, direction_id == stop_to)) %>%
         left_join(line_ranks %>% rename(r_dir2 = r), join_by(line, direction_id == stop_from)) %>%
         left_join(line_ranks %>% rename(r_st1 = r), join_by(line, station_id == stop_to)) %>%
         left_join(line_ranks %>% rename(r_st2 = r), join_by(line, station_id == stop_from)) %>%
         mutate(r_dir = coalesce(r_dir1,r_dir2), r_st = pmin2_na(r_st1,r_st2), r_st1_ = coalesce(r_st1,r_st2), r_st2_ = coalesce(r_st2,r_st1),
                dir = ifelse(!is.na(station_id),replace_na(-(2*as.numeric(r_dir <= r_st)-1),0),NA)) %>%
         select(-(contains(".")))#, -contains("r_"))#, r_st, r_st1, r_st2)

       # Compute temporal lag
       self$data %<>% # time=now
         mutate(lag = as.numeric(self$time-timestamp,units = "secs"))
     },

     assess_risk = function(){
       # Compute marginal risks
       #self$segments %<>% mutate(!!self$.score := inv.logit(rnorm(n(),-0.5,2)))

       self$data %<>%
         mutate(id = row_number()) %>%
         group_by(id) %>%
         nest_by(.key = "row") %>%
         rowwise() %>%
         mutate(
           direct_risk = self$.direct_risk(row),
           bidirect_risk = self$.bidirect_risk(row),
           line_risk = self$.line_risk(row)
         ) %>%
         unnest(row)

       # Diffuse risks in network
       neighbour_segments = self$segments %>%
         as_tibble() %>%
         rename(r_neigh = r) %>%
         select(line, r_neigh)

       station_based = self$data %>%
         left_join(self$segments, join_by(line,overlaps(r_st1_,r_st2_,r,r))) %>%
         group_by(id) %>%
         mutate(
           n_match = n(),
           direct_risk = case_when(
             n_match > 1 & dir == 1 & r_st == r ~ 0,
             n_match > 1 & dir == -1 & r_st != r ~ 0,
             .default = direct_risk
           )
         ) %>%
         left_join(neighbour_segments, relationship = "many-to-many") %>%
         group_by(id) %>%
         filter(n_match == 1 | (n_match > 1 & ((r!=r_st & r<=r_neigh) | (r==r_st & r>=r_neigh)))) %>%
         mutate(
           delta_r_bidirect = ifelse(dir == 0,1,dir)*(r_neigh-r),
           delta_r_direct = pmax(delta_r_bidirect,0),
           m_direct_risk = self$.d_direct(delta_r_direct) * direct_risk,
           m_bidirect_risk = self$.d_bidirect(delta_r_bidirect) * bidirect_risk,
           m_line_risk = self$.d_line(delta_r_bidirect) * line_risk
         ) %>%
         select(id,line,r_neigh,starts_with("m_")) %>%
         rename(r = r_neigh)

       line_based = self$data %>%
         filter(is.na(station_id)) %>%
         left_join(neighbour_segments, relationship = "many-to-many") %>%
         mutate(m_direct_risk = 0, m_bidirect_risk = 0, m_line_risk = line_risk) %>%
         select(id,line,r_neigh,starts_with("m_")) %>%
         rename(r = r_neigh)

       marginal_risk = station_based %>%
         bind_rows(line_based)

       aggregate_risk = self$segments %>%
         as_tibble() %>%
         select(line,r,stop_from,stop_to,network) %>%
         left_join(marginal_risk, join_by(line,r)) %>%
         group_by(network,stop_from,stop_to) %>% #stop_from,stop_to, # line,r
         summarise(
           m_direct_risk = coalesce(pmin(1,sum(m_direct_risk, na.rm = T)),0),
           m_bidirect_risk = coalesce(pmin(1,sum(m_bidirect_risk, na.rm = T)),0),
           m_line_risk = coalesce(pmin(1,sum(m_line_risk, na.rm = T)),0),
           m_sum = pmin(1,m_direct_risk+m_bidirect_risk+m_line_risk)
         ) %>%
         ungroup() %>%
         mutate(score = replace_na(m_sum,0))

       self$segments %<>%
         left_join(aggregate_risk, join_by(network,stop_from,stop_to)) # #stop_from,stop_to # line,r
     },

     .direct_risk = function(row){
       row %$% {
         case_when(
           is.na(dir) ~ 0,
           dir == 0 ~ 0,
           dir == 1 ~ .8,
           dir == -1 ~ .8
         ) %>% self$.s_discount(lag, ttl = 1000, strn = .2, shift = .4)
       }
     },
     .bidirect_risk = function(row){
       row %$% {
         case_when(
           is.na(dir) ~ 0, # to do - bug?
           dir == 0 ~ 1,
           dir == 1 ~ .2,
           dir == -1 ~ .2
         ) %>% self$.s_discount(lag, ttl = 2000, strn = .3, shift = .4)
       }
     },
     .line_risk = function(row){
       row %$%  {
         case_when(
           is.na(station_id) ~ .1,
           .default = .05
         ) %>% self$.s_discount(lag, ttl = 4000, strn = .3, shift = .2)
       }
     },

     .s_discount = function(x, t, ttl = 500, strn = .2, shift = .44) {
       strn_adj = strn * ttl
       adjusted_ttl = ttl*(1+shift)
       discount = 1 / (1 + exp((t - (adjusted_ttl)) / strn_adj))
       x * discount
     },
     .d_direct = function(x = 0:9){
       #self$.dbbinom_scaled(x, alpha=1.632, beta=5, size=13, peak=1)
       self$.dbbinom_scaled(x, alpha = 1.456, beta = 2.547, size = 6, peak = 1)
     },
     .d_bidirect = function(x = -5:5){
       #self$.dbbinom_scaled(x, alpha=1.520, beta=1.587, size=10, peak = 5, shift = 4)
       self$.dbbinom_scaled(x, alpha = 1.336, beta = 1.968, size=5, peak = 1, shift = 1)
     },
     .d_line = function(x = -30:30){
       self$.dbbinom_scaled(x, alpha = 0.9891, beta = 1.175, size=30, peak = 0, shift = 0)
     },
     .dbbinom_scaled = function(x, alpha, beta, size, peak = 1, shift = 0){
       dbbinom(abs(x)+shift, size = size, alpha = alpha, beta = beta)/
         dbbinom(peak, size = size, alpha = alpha, beta = beta)
     },


     project_risk = function(){
       # Project risks to discrete scale
       self$segments %<>% mutate(!!self$.projection := self$.project_risk(score))
     },

     .project_risk = function(score){
       case_when(between(score,0,0.2) ~ "#13C184",
                 between(score,0.2,0.5) ~ "#FACB3F",
                 between(score,0.5,0.9) ~ "#F05044",
                 between(score,0.9,1) ~ "#A92725",
                 .default = "grey")
     }
   )
)


classify_risk = function(...){
  FreifahrenRiskClassifier$new(...)$segments
}

###################################################################################

segments = readRDS("Rstats/segments_v4.RDS")
now = Sys.time() %>% setattr("tzone","UTC")
from = format(now - (60*60)) %>% as.POSIXct(tz="UTC")
suffix = format(Sys.time(), "%Y-%m-%dT%H:%M:%S", tz = "UTC")

# Load data from JSON file instead of database
ticket_info <- jsonlite::fromJSON("Rstats/ticket_data.json")

# Convert timestamp to POSIXct format if data is not empty
if (!is.data.frame(ticket_info) || nrow(ticket_info) == 0) {
  ticket_info <- data.frame(
    timestamp = as.POSIXct(character()),  # create an empty POSIXct column for timestamp
    line = character(),
    station_name = character(),
    station_id = character(),
    direction_id = character(),
    direction_name = character(),
    stringsAsFactors = FALSE  # Avoid factor conversion
  )
} else {
  ticket_info$timestamp <- as.POSIXct(ticket_info$timestamp, format = "%Y-%m-%dT%H:%M:%S", tz = "UTC")

  # Ensure all expected columns are present
  necessary_columns <- c("timestamp", "line", "station_name", "station_id", "direction_id", "direction_name")
  missing_columns <- setdiff(necessary_columns, names(ticket_info))
  
  # Add missing columns as empty
  for (col in missing_columns) {
    ticket_info[[col]] <- vector(mode = "character", length = nrow(ticket_info))
  }
}

# Extract the necessary columns without filtering for time or sorting as the data is already sorted
exc = ticket_info %>%
  select(timestamp, line, station_name, station_id, direction_id, direction_name)


risk_model = segments %>%
  classify_risk(exc, now) %>%
  as_tibble() %>%
  filter(score > .2) %>%
  select(sid, line, color)

write_json(risk_model, "Rstats/output/risk_model_" %.% suffix %.% ".json")