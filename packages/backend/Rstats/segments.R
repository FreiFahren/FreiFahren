################################################################################
#
##### Geospatial Analyis
##### Map test
##### Johann-Friedrich Salzmann
#
################################################################################

# Just some basic stuff I always use to code faster

rm(list = ls(envir = globalenv()),envir = globalenv())

if (!require("pacman")) install.packages("pacman")
library(pacman)

p_load(magrittr)
p_load(ggplot2)
p_load(tidyverse)

p_load(sf)
#p_load(stars)
p_load(units)
#p_load(spData)
#p_load(tmap)
p_load(mapview)
p_load(jsonlite)
#p_load(spdep)
#p_load(sp)
#p_load(gstat)
#p_load(rsample)
#p_load(MLmetrics)
#p_load(terra)
p_load(boot)
p_load(extraDistr)

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

################################################################################

#setwd("./project")

curves = st_read("export.geojson") %>%
  filter(!is.na(ref)) %>%
  rowwise() %>%
  mutate(ft = paste(sort(c(from, to)), collapse = " ")) %>%
  group_by(ft) %>%
  mutate(rank = row_number()) %>%
  filter(rank == 1) %>%
  select(ref,geometry,colour) %>%
  rename(line = ref) %>% 
  rowwise() %>%
  mutate(geometry = list(st_cast(geometry,"LINESTRING"))) %>%
  unnest_longer(geometry) %>%
  mutate(nodes = map_int(geometry,~length(.x))) %>%
  group_by(line) %>%
  arrange(line,-nodes) %>%
  mutate(node_rank = row_number()) %>%
  filter(node_rank == 1) %>%
  ungroup() %>%
  select(-nodes,-node_rank) %>%
  st_as_sf()

#mapview(curves, zcol="line", color=curves$colour)




sl = read_json("StationsAndLinesList.json")

stations = sl$stations %>%
  map(~list(.x)) %>%
  as_tibble(.) %>%
  gather(key = "stop",value = "meta") %>%
  unnest_wider(meta) %>%
  unnest_wider(coordinates) %>%
  unnest_longer(lines) %>%
  rename(line=lines) %>%
  st_as_sf(coords = c("longitude", "latitude"), crs = 4326)

#mapview(curves, zcol="line", color=curves$colour) + mapview(stations)


details = curves %>% 
  st_segmentize(dfMaxLength = 10) %>%
  group_by(line) %>%
  st_cast("POINT") %>%
  mutate(r = row_number())


stations_nf = stations %>% 
  left_join(details %>% nest_by(.key = "details")) %>%
  drop_na() %>% # S42 removed
  rowwise() %>%
  mutate(r = st_nearest_feature(geometry,details)) %>%
  select(-details) %>%
  as_tibble() %>%
  rename(geometry_out = geometry) %>%
  left_join(details %>% as_tibble()) %>%
  rename(geometry_in = geometry) %>% 
  ungroup()

stations_corrected = stations_nf %>%
  select(-geometry_out, -colour, -r) %>%
  rename(geometry = geometry_in) %>%
  st_as_sf()

saveRDS(stations_corrected, "stations_corrected.RDS")

#mapview(stations_corrected) + mapview(curves, zcol="line", color=curves$colour) + mapview(stations, color="red")



curves_points = curves %>%
  group_by(line) %>%
  st_cast("POINT") %>%
  mutate(rc = row_number())

# to do: separate by line
details_ext = details %>%
  group_by(line) %>%
  st_join(curves_points, st_is_within_distance, dist=.001) %>%
  st_join(stations_corrected, st_equals) %>%
  filter(!is.na(line.y) | !is.na(line)) %>%
  select(line.x, colour.x, geometry, r, rc) %>%
  rename(line = line.x, colour = colour.x) %>%
  group_by(line) %>%
  mutate(r_ext = row_number()) %>%
  ungroup()

ring_base = stations_nf %>% filter(line == "S41") %>% filter(r == max(r)) %$% geometry_in[[1]]
details_ext %<>% as_tibble() %>%
  group_by(line) %>%
  mutate(geometry = ifelse(line == "S41" & r %in% c(max(r),min(r)),ring_base,geometry)) %>%
  st_as_sf(crs=4326)

extra_ring = details_ext %>% filter(line == "S41") %>%
  mutate(f = r_ext == 1, r_ext = max(r_ext)+1, r=max(r)+1) %>%
  filter(f) %>% select(-f)

details_ext %<>% bind_rows(extra_ring)

curves_ext = details_ext %>%
  group_by(line) %>%
  summarise(do_union=FALSE) %>%
  st_cast("LINESTRING")



segments = stations_nf %>%
  select(-geometry_in, -geometry_out) %>% 
  arrange(line,r) %>%
  group_by(line) %>%
  rename(r_to = r, stop_to = stop, name_to = name, line_color = colour) %>%
  mutate(
    r_from = lag(r_to), stop_from = lag(stop_to), name_from = lag(name_to),
    #r_to = ifelse(is.na(r_from) & line == "S41",max(r_from,na.rm = T),r_to),
    r_from = ifelse(is.na(r_from) & line == "S41",0,r_from),
    stop_from = ifelse(is.na(stop_from) & line == "S41",last(stop_to),stop_from),
    name_from = ifelse(is.na(name_from) & line == "S41",last(name_to),name_from)
  ) %>%
  drop_na() %>%
  mutate(r = row_number()) %>%#, r_lower = pmin(r_from,r_to), r_upper = pmax(r_from,r_to)) %>%
  nest_join(details_ext, join_by(line, r_from <= r, r_to >= r), name = "details") %>%
  rowwise() %>%
  mutate(geometry = details %>% summarise(do_union=FALSE) %>% st_cast("LINESTRING") %$% geometry) %>%
  select(-details, -r_from, -r_to) %>%
  ungroup() %>%
  mutate(network = str_sub(line,1,1), sid = line %.% "-" %.% r) %>%
  st_as_sf()

saveRDS(segments, "segments_v5.RDS")

segments_json = segments %>%
  select(sid, line, line_color, geometry)

st_write(segments_json, "segments_v5.geojson")

mapview(segments,zcol="line")


