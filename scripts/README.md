# Scripts

Overpass Turbo query to get the data for all lines:

```
[out:json][timeout:25];
// Define the area of Berlin
{{geocodeArea:Berlin}}->.searchArea;
    (
      relation(id:1929070); // S1
      relation(id:2269238); // S2
      relation(id:2343465); // S3
      relation(id:2015959); // S5
      relation(id:2017023); // S7
      relation(id:2269252); // S8
      relation(id:2389946); // S9
      relation(id:2422951); // S25
      relation(id:7794031); // S26
      relation(id:14981); // S41
      relation(id:14983); // S42
      relation(id:2422929); // S46
      relation(id:2413846); // S47
      relation(id:2174798); // S75
      relation(id:2979451); // S85
      relation(id:2669205); // U1
      relation(id:2669184); // U2
      relation(id:2669208); // U3
      relation(id:2676945); // U4
      relation(id:2227744); // U5
      relation(id:2679164); // U6
      relation(id:2678986); // U7
      relation(id:2679014); // U8
      relation(id:2679017); // U9
      relation(id:2076230); // M1
      relation(id:1981932); // M2
      relation(id:2012424); // M4
      relation(id:5829220); // M5
      relation(id:2076355); // M6
      relation(id:5829222); // M8
      relation(id:2077032); // M10
      relation(id:2077077); // M13
      relation(id:2077162); // M17

    );

    out body;
>;
out skel qt;
```
