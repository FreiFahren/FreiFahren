node_keys = {
  "addr:housenumber",
  "amenity",
  "highway",
  "leisure",
  "name",
  "natural",
  "place",
  "public_transport",
  "railway",
  "shop",
  "station",
  "tourism"
}

ZRES9 = 305.7
ZRES10 = 152.9
ZRES11 = 76.4

way_keys = {
  "aeroway",
  "admin_level",
  "barrier",
  "boundary",
  "bridge",
  "building",
  "highway",
  "landuse",
  "leisure",
  "name",
  "natural",
  "oneway",
  "railway",
  "tunnel",
  "water",
  "waterway"
}

function first_non_empty(...)
  local values = { ... }
  for _, value in ipairs(values) do
    if value ~= nil and value ~= "" then
      return value
    end
  end
  return ""
end

function add_names()
  local name = Find("name")
  if name ~= "" then
    Attribute("name", name)
  end

  local name_ltn = first_non_empty(Find("name:latin"), Find("int_name"), Find("name:en"))
  if name_ltn ~= "" and name_ltn ~= name then
    Attribute("name_ltn", name_ltn)
  end

  local languages = { "de", "en", "es", "fr", "it", "ja", "ko", "nl", "ru", "zh" }
  for _, lang in ipairs(languages) do
    local translated = Find("name:" .. lang)
    if translated ~= "" then
      Attribute("name_" .. lang, translated)
    end
  end
end

function add_structure()
  if Find("bridge") ~= "" and Find("bridge") ~= "no" then
    Attribute("structure", "bridge")
  elseif Find("tunnel") ~= "" and Find("tunnel") ~= "no" then
    Attribute("structure", "tunnel")
  end
end

function landuse_class()
  local landuse = Find("landuse")
  local leisure = Find("leisure")
  local natural = Find("natural")
  local amenity = Find("amenity")
  local boundary = Find("boundary")
  local aeroway = Find("aeroway")

  if landuse == "cemetery" or amenity == "grave_yard" then return "cemetery" end
  if landuse == "meadow" or landuse == "grass" or natural == "grassland" then return "grass" end
  if amenity == "hospital" then return "hospital" end
  if amenity == "parking" or landuse == "parking" then return "parking" end
  if landuse == "industrial" or landuse == "commercial" or landuse == "retail" or aeroway ~= "" then return "industrial" end
  if boundary == "national_park" or leisure == "nature_reserve" then return "national_park" end
  if leisure == "park" or leisure == "recreation_ground" or landuse == "village_green" or leisure == "dog_park" or leisure == "playground" or leisure == "sports_centre" or leisure == "garden" or landuse == "allotments" then return "park" end
  if leisure == "golf_course" or leisure == "pitch" or leisure == "stadium" or leisure == "track" then return "pitch" end
  if amenity == "college" or amenity == "school" or amenity == "university" then return "school" end
  if natural == "heath" or natural == "scrub" then return "scrub" end
  if natural == "wood" or landuse == "forest" then return "wood" end
  if natural == "beach" then return "beach" end

  return ""
end

function road_class(highway, railway)
  if railway == "rail" or railway == "subway" or railway == "light_rail" or railway == "monorail" or railway == "narrow_gauge" then
    return "major_rail"
  end
  if railway == "tram" or railway == "funicular" or railway == "preserved" or railway == "disused" then
    return "minor_rail"
  end
  if highway == "motorway" then return "motorway" end
  if highway == "motorway_link" then return "motorway_link" end
  if highway == "trunk" or highway == "primary" or highway == "secondary" or highway == "tertiary" then return "main" end
  if highway == "trunk_link" or highway == "primary_link" or highway == "secondary_link" or highway == "tertiary_link" or highway == "unclassified" or highway == "residential" then return "street" end
  if highway == "pedestrian" or highway == "living_street" then return "street_limited" end
  if highway == "track" or highway == "service" or highway == "busway" then
    if Find("service") == "driveway" then return "driveway" end
    return "service"
  end
  if highway == "path" or highway == "footway" or highway == "bridleway" or highway == "cycleway" or highway == "steps" then return "path" end

  return ""
end

function road_z_order(class)
  local orders = {
    path = 10,
    minor_rail = 20,
    major_rail = 30,
    service = 40,
    driveway = 45,
    street_limited = 50,
    street = 60,
    main = 70,
    motorway_link = 80,
    motorway = 90
  }
  return orders[class] or 0
end

function road_minzoom(class, type)
  if class == "motorway" or class == "motorway_link" then return 5 end
  if class == "main" and type == "trunk" then return 7 end
  if class == "main" and type == "primary" then return 8 end
  if class == "main" then return 9 end
  if class == "major_rail" then return 10 end
  if class == "minor_rail" then return 11 end
  if class == "street" then return 11 end
  if class == "street_limited" then return 12 end
  if class == "service" or class == "driveway" or class == "path" then return 13 end

  return 14
end

function landuse_minzoom(class)
  if class == "park" or class == "national_park" or class == "wood" or class == "water" then return 7 end
  if class == "grass" or class == "scrub" or class == "beach" then return 10 end
  if class == "industrial" or class == "parking" then return 11 end
  if class == "school" or class == "hospital" or class == "cemetery" or class == "pitch" then return 12 end

  return 14
end

function should_emit_road(class, type)
  return true
end

function should_emit_water(class, area)
  if class == "river" or class == "canal" or class == "lake" or class == "reservoir" or class == "harbour" then
    return area >= ZRES10 * ZRES10
  end

  return area >= ZRES9 * ZRES9
end

function should_emit_waterway(class)
  return class == "river" or class == "canal"
end

function should_emit_landuse(class, area)
  if (class == "park" or class == "wood" or class == "industrial") and area < ZRES11 * ZRES11 then
    return false
  end

  if (class == "grass" or class == "scrub" or class == "pitch" or class == "parking") and area < ZRES11 * ZRES11 then
    return false
  end

  if class == "water" and area < ZRES11 * ZRES11 then
    return false
  end

  return true
end

function node_function()
  local place = Find("place")
  if place ~= "" then
    Layer("place_label", false)
    Attribute("class", place)
    add_names()
    if place == "city" then MinZoom(3)
    elseif place == "town" then MinZoom(6)
    else MinZoom(10) end
  end

  local railway = Find("railway")
  local station = Find("station")
  local public_transport = Find("public_transport")
  if railway == "station" or railway == "halt" or station ~= "" or public_transport == "station" then
    Layer("transit_label", false)
    Attribute("class", first_non_empty(railway, public_transport, station))
    add_names()
    MinZoom(11)
  end

  local amenity = Find("amenity")
  local shop = Find("shop")
  local tourism = Find("tourism")
  if amenity ~= "" or shop ~= "" or tourism ~= "" then
    Layer("poi_label", false)
    Attribute("class", first_non_empty(amenity, shop, tourism))
    add_names()
    MinZoom(13)
  end

  local house_num = Find("addr:housenumber")
  if house_num ~= "" then
    Layer("housenum_label", false)
    Attribute("house_num", house_num)
    MinZoom(14)
  end
end

function way_function()
  local is_area = IsClosed()
  local boundary = Find("boundary")
  local admin_level = tonumber(Find("admin_level"))
  if boundary == "administrative" and admin_level ~= nil and admin_level <= 4 then
    Layer("admin", false)
    AttributeNumeric("admin_level", admin_level)
    AttributeBoolean("disputed", Find("disputed") == "yes")
    AttributeBoolean("maritime", Find("maritime") == "yes")
    MinZoom(admin_level == 2 and 0 or 4)
  end

  local aeroway = Find("aeroway")
  if aeroway ~= "" then
    Layer("aeroway", is_area)
    Attribute("type", aeroway)
    MinZoom(aeroway == "runway" and 9 or 11)
  end

  local landuse = landuse_class()
  if landuse ~= "" and is_area and should_emit_landuse(landuse, Area()) then
    Layer("landuse", true)
    Attribute("class", landuse)
    add_names()
    MinZoom(landuse_minzoom(landuse))
  end

  local natural = Find("natural")
  local water = Find("water")
  if is_area and (natural == "water" or water ~= "" or Find("waterway") == "riverbank") and should_emit_water(first_non_empty(water, natural, "water"), Area()) then
    Layer("water", true)
    Attribute("class", first_non_empty(water, natural, "water"))
    add_names()
  end

  local waterway = Find("waterway")
  if waterway ~= "" and not is_area and should_emit_waterway(waterway) then
    Layer("waterway", false)
    Attribute("class", waterway)
    add_structure()
    add_names()
  end

  local building = Find("building")
  if building ~= "" and building ~= "no" and is_area then
    Layer("building", true)
    Attribute("type", building)
    local height = tonumber(Find("height"))
    local min_height = tonumber(Find("min_height"))
    if height ~= nil then AttributeNumeric("height", height) end
    if min_height ~= nil then AttributeNumeric("min_height", min_height) end
    AttributeBoolean("extrude", height ~= nil)
    MinZoom(14)
  end

  local barrier = Find("barrier")
  if barrier == "fence" or barrier == "city_wall" or barrier == "retaining_wall" or barrier == "wall" or barrier == "wire_fence" or barrier == "hedge" or barrier == "gate" or barrier == "lift_gate" or barrier == "kissing_gate" or natural == "cliff" then
    Layer("structure", is_area)
    if natural == "cliff" then
      Attribute("class", "cliff")
      Attribute("type", "cliff")
    elseif barrier == "hedge" then
      Attribute("class", "hedge")
      Attribute("type", "hedge")
    elseif barrier == "gate" or barrier == "lift_gate" or barrier == "kissing_gate" then
      Attribute("class", "gate")
      Attribute("type", barrier)
    else
      Attribute("class", "fence")
      Attribute("type", barrier)
    end
    MinZoom(13)
  end

  if Find("man_made") == "pier" or Find("bridge") == "yes" then
    Layer("structure", is_area)
    Attribute("class", "bridge")
    Attribute("type", Find("man_made") == "pier" and "pier" or "bridge")
    MinZoom(13)
  end

  local highway = Find("highway")
  local railway = Find("railway")
  local class = road_class(highway, railway)
  local type = first_non_empty(highway, railway)
  if class ~= "" and should_emit_road(class, type) then
    Layer("road", is_area)
    Attribute("class", class)
    Attribute("type", type)
    AttributeBoolean("oneway", Find("oneway") == "yes" or Find("oneway") == "1" or Find("oneway") == "true")
    add_structure()
    add_names()
    local ref = Find("ref")
    if ref ~= "" then
      Attribute("ref", ref)
      AttributeNumeric("reflen", string.len(ref))
    end
    local access = Find("access")
    if access ~= "" then Attribute("access", access) end
    MinZoom(road_minzoom(class, type))
    ZOrder(road_z_order(class))
  end
end
