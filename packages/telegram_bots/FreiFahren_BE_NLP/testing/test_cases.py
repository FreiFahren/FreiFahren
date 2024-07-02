test_cases = [
    (
        'heinrich-heine zwei blauwesten',

        'Heinrich-Heine-Straße',

        None,
        None
    ),
    (
        'U6 Schumacher-Platz 2 Controller merhingdam',

        'Mehringdamm',

        'U6',

        None,
    ),
    (
        '2x Hellblau U8 Hermannplatz Richtung Wittenau am Bahnsteig',

        'Hermannplatz',

        'U8',

        'Wittenau',

    ),
    (
        'U8 pankstrasse 2 Blau veste',

        'Pankstraße',

        'U8',

        None
    ),
    (
        '2 Kontrolleure U9 Richtung Osloer Straße',

        None,
        'U9',

        'Osloerstraße'
    ),
    (
        'Und zwei Cops oben am Bahnsteig der SBahn',

        None,
        None,
        None
    ),
    (
        'U 8 Heinrich Heine str',

        'Heinrich-Heine-Straße',

        'U8',

        None
    ),
    (
        'Friedrichstrasse bei der u6 waren gerade zwei mit bos westen',

        'Friedrichstraße',

        'U6',

        None,
    ),
    (
        '2personen dunkel blaue weste',

        None,
        None,
        None
    ),
    (
        'U2 Ernst Reuter Platz',

        'Ernst-Reuter-Platz',

        'U2',

        None
    ),
    (
        'U9 4 (oder mehr) blauwesten auf Gleis Spichernstraße',

        'Spichernstraße',

        'U9',

        None,
    ),
    (
        'Zwei Stück Richtung Osloer',

        None,
        None,
        'Osloerstraße'
    ),
    (
        'Jetzt Zoo in der Bahn richtung Steglitz!',

        'Zoologischer Garten',

        None,
        'Rathaus Steglitz',

    ),
    (
        '''U6 Mehringdamm -> hallesches Tor gerade ausgestiegen. 2 Kontrolleure
        in schwarz,glaube ich. :''',

        'Hallesches Tor',

        None,
        None,
    ),
    (
        '''S Alexanderplatz west direction at least one ticket checker with
        a white puffer jacket on the platform''',

        'Alexanderplatz',

        None,
        None,
    ),
    (
        'u6 leopoldplatz towards alt mariendorf 2 people with 2 cops',

        'Leopoldplatz',

        'U6',

        'Alt-Mariendorf',

    ),
    (
        'u6 paradestraße ausgestiegen.',

        'Paradestraße',

        'U6',
        None
    ),
    (
        'U boddinstrasse. 5 securitys / 3 cops',

        'Boddinstraße',

        'U8',
        None
    ),
    (
        'Gerade S Tiergarten Richtung zoo',

        'Tiergarten',

        None,
        'Zoologischer Garten',

    ),
    (
        'Walther Schreiber Platz U9 Richtung Rathaus Steglitz Kontrolletis',

        'Walther-Schreiber-Platz',

        'U9',

        'Rathaus Steglitz',

    ),
    (
        '2 in schwarz S tempelhof',

        'Tempelhof',

        None,
        None
    ),
    (
        'Grad ausgestiegen s41',

        None,
        None,
        None
    ),
    (
        '''S7,2 männlich gelesene in zivil grad Friedrichstraße
        mit jemandem ausgestiegen''',

        'Friedrichstraße',

        None,
        None,
    ),
    (
        'Ring zwischen S Tempelhof und S Hermannstraße',

        'Tempelhof',

        'S41',
        None
    ),
    (
        'U2 Märkisches Museum richtung ruhleben 3 Männer mit B.O.S Jacken',

        'Märkisches Museum',

        'U2',

        'Ruhleben',

    ),
    (
        'Ring Bahn Hohenzollerndamm vor 2 Minuten eine Person alleine',

        'Hohenzollerndamm',

        'S41',
        None,
    ),
    (
        '''S1 Richtung Spindersfeld,männlich gelesen gerade
        bei hermannstraße geht durch die Bahn''',

        'Hermannstraße',

        'S1',

        'Spindlersfeld',

    ),
    (
        'S1 nach spindlersfelde war ein am hermannplatz oder vorher',

        'Hermannplatz',

        'S1',

        'Spindlersfeld',

    ),
    (
        'U8 Wittenau sind U Jannowitzbrücke raus',

        'Jannowitz Brücke',

        None,
        None,
    ),
    (
        'messe nord grad raus',

        'Messe Nord/ICC',

        None,
        None
    ),
    (
        '3x weiblich jetzt westkreuz ina s41',

        'Westkreuz',

        'S41',

        None
    ),
    (
        'Kontrolle in s42 jetzt Treptower Park',

        'Treptower Park',

        'S42',

        None
    ),
    (
        'Kontrolle auf der Strecke u9',

        None,
        'U9',

        None
    ),
    (
        'BOS Alex u8 on the platform',

        'Alexanderplatz',

        'U8',

        None
    ),
    (
        'A lot of bvg and cops,outside,at Hermanplatz',

        'Hermannplatz',

        None,
        None,
    ),
    (
        '''3x m gelesen 1x w gelesen am hermannplatz Gleis u8 Richtung
        hermannstraße blaue bos jacken''',

        'Hermannplatz',

        'U8',

        'Hermannstraße',

    ),
    (
        'S42 greiswalder strasse2 Männer 1 frau',

        'Greifswalderstraße',

        'S42',

        None,
    ),
    (
        '''Ring zwischen Hohenzollerndamm und Halensee. 3x weiblich gelesen,
        davon 1x weiße Jacke,1x schwarz glänzende Jacke''',

        'Hohenzollerndamm',

        'S41',
        None,
    ),
    (
        '''2 Kontrolleure read male black outfits black beards in S8
        to Ostkreuz,now Storkower Str got off at Storkower Straße''',

        'Storkowerstraße',

        None,
        None,
    ),
    (
        '''S41 gleich Tempelhof. Ein Typ,eine Frau. Beide schwarze Kapuzenjacke.
        Er mit North Face Mütze schwarz,Sie mit langen blonden Haaren''',

        'Tempelhof',

        'S41',

        None,
    ),
    (
        '''U6 steigen gerade Wedding ein Richtung alt mariendorf
        im hinteren Teil der Bahn 3m blaue Jacken''',

        'Wedding',

        'U6',

        'Alt-Mariendorf',

    ),
    (
        '''Kontrolleur m gelesen S2 Frohnau jetzt Halensee In zivil,schwarze
        Jacke,schwarze Haare,braune Ledertasche''',

        'Halensee',

        'S2',

        'Frohnau',

    ),
    (
        'Jannowitzbrücke U8',

        'Jannowitz Brücke',

        'U8',

        None
    ),
    (
        'S42 Tempelhof ein Mann und eine Frau mit langen blonden Haaren.',

        'Tempelhof',

        'S42',

        None,
    ),
    (
        'S41 tempelhof',

        'Tempelhof',

        'S41',

        None
    ),
    (
        '''U6 Friedrichstrasse direction north,K.Schumacher platz,
        3 mannlich gelesen mit B.O.B. jackets''',

        'Friedrichstraße',

        'U6',

        'Kurt-Schumacher-Platz',

    ),
    (
        '2 männer S42 Treptower park',

        'Treptower Park',

        'S42',

        None
    ),
    (
        'S41 in Storkowerstr Richtung Ostkreuz',

        'Storkowerstraße',

        'S41',

        None,

    ),
    (
        '2 civil controllis in s 41 to landsberger',

        None,
        'S41',

        None,

    ),
    (
        'Three female kontrolettis in the S42 soon to be Bundesplatz',

        'Bundesplatz',

        'S42',

        None,
    ),
    (
        'S45 Flughafen BER',

        'Flughafen BER',

        'S45',

        None
    ),
    (
        '''Sind jetzt jungfeenheide. 1 x mal männlich und 1x mal weiblich
        gelesen komplett in schwarz''',

        'Jungfernheide',

        None,
        None,
    ),
    (
        'S8 Ostkreuz',

        'Ostkreuz',

        'S8',

        None
    ),
    (
        '''Controller in S7 Richtung Alexanderplatz
        Was just checked in jannowitzbrucke''',

        'Jannowitz Brücke',

        'S7',

        'Potsdam Hauptbahnhof',

    ),
    (
        '''S42 Landsberger Alle,2m,schwarze Jacke,schwarze Mütze. 2 m mit
        Gelber Weste begleiten.''',

        'Landsberger Allee',

        'S42',

        None,
    ),
    (
        '3 Kontrolleure s Greifswalder',

        'Greifswalderstraße',

        None,
        None
    ),
    (
        'S8 Greifswalder Straße',

        'Greifswalderstraße',

        'S8',

        None
    ),
    (
        'S41 Ringbahn Landsberger allee big group of kontrolettis',

        'Landsberger Allee',

        'S41',

        None,
    ),
    (
        '''Ring 41-> Landsberger Allee,glaube mehrere
        männer die auch Minderjährige hochnehmen''',

        'Landsberger Allee',

        'S41',

        None,
    ),
    (
        'S42,3x agressiv männlich,gerade Schönhauser ausgestiegen',

        'Schönhauser Allee',

        None,
        None,
    ),
    (
        'Ring s42  approaching geundbrunnen civil control',

        'Gesundbrunnen',

        'S42',

        None,
    ),
    (
        '5 Kontrolleure S8 to Birkenwerder',

        None,
        'S8',

        'Birkenwerder'
    ),
    (
        'U8 heinrrich heinest blue vest at platform',

        'Heinrich-Heine-Straße',

        'U8',

        None,
    ),
    (
        'Friedrichstraße',

        'Friedrichstraße',

        None,
        None
    ),
    (
        '''Spichernstraße U3 am Bahnsteig eine Person männl gelesen,komplett
        schwarz angezogen mit braunem undercut,ca 30 Jahre.. wirkt aber sehr
        nett weil er grad jemand erklärt wie er das Ticket einer anderen Person
        nachreichen kann''',

        'Spichernstraße',

        'U3',

        None,
    ),
    (
        '2x Blauwesten u8 Heinrich Heine straße Richtung Hermannstraße',

        'Heinrich-Heine-Straße',

        'U8',

        'Hermannstraße',

    ),
    (
        '''Bitte hier keine Fragen,ob diese oder jene Linie gerade frei ist,
        sondern stattdessen die Suchfunktion (das Lupensymbol) nutzen. Danke!
        Nachricht gelöscht.''',

        None,
        None,
        None,
    ),
    (
        '''U1 at hallesches tor towards warschauer str.
        2 maybe 3 blue wests giving fines''',

        'Hallesches Tor',

        'U1',

        'Warschauerstraße',

    ),
    (
        '''Wenn mein Infopost über die Demo am Sonntag Nachmittag gegen Rechts
        als Spam gewertet wird (über die ja auch im Bild der Gruppe informiert
        wird) würde ich mir eine kurze Rückmeldung von euch darüber wünschen''',

        None,
        None,
        None,
    ),
    (
        '''No basically this is the decision of the admins who run this group
        because we share certain values and leftist politics. If you happen to
        dislike actions against fascists,its you who might not belong in this
        group. Like Spam.''',

        None,
        None,
        None,
    ),
    (
        'S41 Treptower Park,2 Männer',

        'Treptower Park',

        'S41',

        None
    ),
    (
        'U1 hallesches tor in der bahn richtung westen',

        'Hallesches Tor',

        'U1',

        'Uhlandstraße',

    ),
    (
        '''s7 nach Ahrensfelde 3 Männer schwarze jacken
        hackescher markt ausgestiegen''',

        'Hackescher Markt',

        None,
        None,
    ),
    (
        'Ring S41 Sonnenallee Richtung Neukölln',

        'Sonnenallee',

        'S41',

        None
    ),
    (
        'U6 friedrichstr',

        'Friedrichstraße',

        'U6',

        None
    ),
    (
        'S42 two guys at frankfurterallee',

        'Frankfurter Allee',

        'S42',

        None
    ),
    (
        'Alexanderplatz an Gleis der u8 hellblaue westen',

        'Alexanderplatz',

        'U8',

        None,
    ),
    (
        '4x männlich gelesen S42 aktuell Landsbegwr immer noch im Zug',

        'Landsberger Allee',

        'S42',

        None,
    ),
    (
        'Alexanderplatz sbahn platform',

        'Alexanderplatz',

        None,
        None
    ),
    (
        '41 wedding. Grun mantel',

        'Wedding',

        'S41',

        None
    ),
    (
        '''Ostbahnhof 8 Bundesbullen stehen an der Bahnsteigkante.
        Alle mit gelben Westen. Keine Ahnung ob die eingestiegen sind.''',

        'Ostbahnhof',

        None,
        None,
    ),
    (
        'Ostkreuz 6 Polizisten kontrollieren Ausweise willkürlich',

        'Ostkreuz',

        None,
        None,
    ),
    (
        'U6 Unter den Linden',

        'Unter den Linden',

        'U6',

        None
    ),
    (
        '''unter den Linden,U6,Richtung Tegel,
        eine m gelesene Person mit blauer wrtse''',

        'Unter den Linden',

        'U6',

        'Alt-Tegel',

    ),
    (
        '''U6 Richtung alt Mariendorf Stadtmitte eingestiegen
        2 blauwesten m gelesen''',

        'Stadtmitte',

        'U6',

        'Alt-Mariendorf',

    ),
    (
        'U8 Hermannstr,just saw police + BVG going downstairs from the street',

        'Hermannstraße',

        'U8',

        None,
    ),
    (
        'U8 Hermannstraße',

        'Hermannstraße',

        'U8',

        None
    ),
    (
        'S42 Hermanstraße,2x schwarze Jacken',

        'Hermannstraße',

        'S42',

        None
    ),
    (
        'S25 S Hennigsdorf a least 2Pers.',

        'Hennigsdorf',

        'S25',

        None
    ),
    (
        '3 Blauwesten Ubhf Heinrich Heine Str',

        'Heinrich-Heine-Straße',

        'S7',
        None,
    ),
    (
        '''U3 freie Universität stehen blau Westen. Sie werden wohl die nächste
        Bahn in die Innenstadt nehmen''',

        'Freie Universität (Thielplatz)',

        'U3',

        None,
    ),
    (
        'U8 rosenthaler Richtung hermanstr',

        'Rosenthaler Platz',

        'U8',

        'Hermannstraße',

    ),
    (
        'U2 From Alex to Ruhleben now bunch of them in a wagon',

        'Alexanderplatz',

        'U2',

        'Ruhleben',

    ),
    (
        '''3 mänlich gelesene 2 mit gelben westen 1 mit blauer bos weste alex
        u8 richtung wittenau''',

        'Alexanderplatz',

        'U8',

        'Wittenau',

    ),
    (
        'About to get off s8 Prenzlauer Allee',

        'Prenzlauer Allee',

        None,
        None
    ),
    (
        's47 nach spindlerfeld s tempelhof eingestiegen 2 in zivil',

        'Tempelhof',

        'S47',

        'Spindlersfeld',

    ),
    (
     's-bahn kontrolleure friedrichstrasse 2mal weiblich eine kräftig und blonde haare lang andere dünner grüne jacke',
     'Friedrichstraße',
     None, None),
    (
     '4 Kontrolleur*innen S85 nach Buch',
     None, 'S85',
     'Buch'),
    (
     'Sind nicht zu übersehen 😅',
     None, None, None),
    (
     'U5 nach Hönow',
     None, 'U5',
     'Hönow'),
    (
        'Blaue veste',
        None, None, None),
    (
     'S42 grade landsbergeralee los',
     'Landsberger Allee',
     'S42',
     None),
    (
     'froilein rattenmeier sie/shehey kurze frage: der kontroletti hat meinen namen falsch geschrieben, adresse stimmt aber. kann das ...Wenn deine Ausweisnummer stimmt finden die dich überall in der EU außer in Rumänien 😬',
     None, None, None),
    (
     'FlinnUnd wenn er den Namen hat aber nicht die Adresse?Die Ausweisnummer bzw das Personaldokument worüber sie dich aufgenommen haben ist entscheidend',
     None, None, None),
    (
     'zwei bos westen mit gelbem nacken sind gerade schönleinstr u8 richtung hermannstr eingestiegen',
     'Schönleinstraße',
     'U8',
     'Hermannstraße'),
    (
     '3 bos u8 richtung wittenau, weinmeisterstr ausgestiegen',
     'Weinmeisterstraße',
     'U8',
     None),
    (
     'Große Kontrolle beim aussteigen an der U-Alt-Tempelhof U6',
     'Alt-Tempelhof',
     'U6',
     None),
    (
     'Ring, tempelhof, richtung sudkreuz',
     'Tempelhof',
     'S41',
     None),
    (
     'u8 Voltastr.',
     'Voltastraße',
     'U8',
     None),
    (
     'mind. 2 blaue westen am leopoldplatz, polizei ist auch da, am u9 gleis',
     'Leopoldplatz',
     'U9',
     None),
    (
     'Neukölln  sbahn 2 männlich gelesene',
     'Neukölln',
     None, None),
    (
     'Lazi ♀️Neukölln  sbahn 2 männlich geleseneBeide glatze',
     'Neukölln',
     None, None),
    (
     'Jetzt noch zusätzlich zwei weitere steigen von s41 aus in Tempelhof',
     'Tempelhof',
     'S41',
     None),
    (
     '2 Männer mit blauen Westen stiegen in die U8 Richtung Witteneu @ Henrich-Heine-Straße ein',
     'Henrich-Heine-Straße',
     'U8',
     'Wittenau'),
    (
     'S7 Richtung potsdam Hbf, 3 w gelesen, gleich griebnitzsee',
     'Griebnitzsee',
     'S7',
     'Potsdam Hauptbahnhof'),
    (
     'u5 straußberger Richtung hönow',
     'Strausberger Platz',
     'U5',
     'Hönow'),
    (
     'u7 Richtung spandau. Drei Mal in BVG Uniform. Gerade hermannplatz',
     'Hermannplatz',
     'U7',
     'Spandau'),
    (
     'S85 Plänterwald Richtung Grünau',
     'Plänterwald',
     'S85',
     'Grünau'),
    (
     '4x in Zivil, schwarze Jacken',
     None, None, None),
    (
     'gibts ein updare zur u7?',
     None, None, None),
    (
     '⁃ Bitte keine Fragen ob eine Linie bzw. ein Ort frei ist. Alle gesichteten Kontrollen sollten hier stehen.',
     None, None, None),
    (
     'Mehr Infos sind in der angehefteten Nachricht.',
     None, None, None),
    (
     'Für Fragen gibt es die @Diskussionsgruppe.TelegramA in Freifahren_BE🚂 \u206d Initiative gegen Ticketpflicht im ÖPNV 🚂',
     None, None, None),
    (
     '(english version below)',
     None, None, None),
    (
     'Bitte helft mit und schreibt kurz, wenn ihr Kontrollen seht oder erlebt, Fehlve...VIEW MESSAGE',
     None, None, None),
    (
     'U6, Alt-Tempelhof, gemischt in Zivil und mit BVG-Jacke.',
     'Alt-Tempelhof',
     'U6',
     None),
    (
     'U6, Paradestraße Richtung Kurt-Schumacher-Platz, BVG zusammen mit Polizei. Mind. zu sechst.',
     'Paradestraße',
     'U6',
     'Kurt-Schumacher-Platz'),
    (
     'Jetzt U9 Hansaplatz Richtung Osloer',
     'Hansaplatz',
     'U9',
     'Osloerstraße'),
    (
     'S41 Hermannstr eingestiegen, 3 Männer 2 in schwarzer 1 in brauner Jacke',
     'Hermannstraße',
     'S41',
     None),
    (
     '1x Braun lilane North face Jacke, kurze schwarze haare, männlich gelesen',
     None, None, None),
    (
     '1x schwarze Jacke, schwarze kurze haare, bisschen Bart',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'Kommen grade mit s41 von hermannstraße nach Tempelhof an',
     'Tempelhof',
     'S41',
     None),
    (
     'Nicolas Sidiropulos1x Braun lilane North face Jacke, kurze schwarze haare, männlich gelesen',
     'Nicolassee', 'S1', None),
    (
     '1x schwarze Jacke, schwarze...Waren 3',
     None, None, None),
    (
     'Einer hat nen kleinen Dutt und ne brille',
     None, None, None),
    (
     'U8 Rosenthaler Platz',
     'Rosenthaler Platz',
     'U8',
     None),
    (
     'Richtung hackeischet markt',
     None, None, 'Hackescher Markt'),
    (
     '2 blaue Westen U9 Richtung Steglitz ',
     None, 'U9',
     'Rathaus Steglitz'),
    (
     'am u amruner str ausgestiegen',
     'Amrumerstraße',
     'S7', None),
    (
     '3 Männer  U6 - Alt-Tempelhof',
     'Alt-Tempelhof',
     'U6',
     None),
    (
     'Stehen Richtung Zoo',
     None, None, 'Zoologischer Garten'),
    (
     'U7 rudow direction, richard wagner platz, 2 blue vests',
     'Rudow',
     'U7',
     'Richard-Wagner-Platz'),
    (
     'U2 nollendorfplatz richtung ruhleben',
     'Nollendorfplatz',
     'U2',
     'Ruhleben'),
    (
     'Polizei boddinstrasse',
     'Boddinstraße',
     'U8', None),
    (
     'U5 Alexanderplatz am Gleis richtung HBF 2 Blauwesten',
     'Alexanderplatz',
     'U5',
     'Hauptbahnhof'),
    (
     'U6 Seetr. Richtung Alt. Mariendorf :  Bullen und BVG Security stressen Obdachlose',
     None, 'U6',
     'Alt-Mariendorf'),
    (
     'Ring Neukölln, two man with yellow shirt. S41 right now',
     'Neukölln',
     'S41',
     None),
    (
     'Osloer Str U9',
     'Osloerstraße',
     'U9',
     None),
    (
     'nuxU5 Alexanderplatz am Gleis richtung HBF 2 BlauwestenUff-Basse !',
     'Alexanderplatz',
     'U5',
     'Hauptbahnhof'),
    (
     'U7 Wilmersdorfer str richtung Rudow',
     'Wilmersdorferstraße',
     'U7',
     'Rudow'),
    (
     '2männer in blau',
     None, None, None),
    (
     'Ringbahn S41 jetzt gleich Tempelhof',
     'Tempelhof',
     'S41',
     None),
    (
     'U8 Richtung hermannstraße',
     None, 'U8',
     'Hermannstraße'),
    (
     'Just got out there standing on the platform Bernauer Straße',
     'Bernauerstraße',
     'U8', None),
    (
     'Sind ausgestiegen Bernauer Straße',
     'Bernauerstraße',
     'U8', None),
    (
     'U7 Wilmersdorfer str richtung rudow standing on the platform, 4 men wearing blue vests',
     'Wilmersdorferstraße',
     'U7',
     'Rudow'),
    (
     'Stephen MarcalanRingbahn S41 jetzt gleich TempelhofWie sehen die aus?',
     None,
     None,
     None),
    (
     'U8 Bernauerstr richtung Hermannstr, 3 Blauevesten',
     'Bernauerstraße',
     'U8',
     'Hermannstraße'),
    (
     'Drei am Bahnhof Zoo, U9 Richtung Rathaus Steglitz',
     'Zoologischer Garten',
     'U9',
     'Rathaus Steglitz'),
    (
     'Riesen Gruppe mit bos Jacken mitten auf Bahnsteig rosenthalerplatz',
     'Rosenthaler Platz',
     'U8', None),
    (
     '2bos mehringdamm am gleis u7/u6',
     'Mehringdamm',
     None,
     None),
    (
     'Diese Leute am Moritzplatz. nicht Kontrolleur(?)',
     None,
     None, None),
    (
     'Mehringdamm jetzt viele',
     'Mehringdamm',
     None, None),
    (
     'dumbass óskPhoto, Diese Leute am Moritzplatz. nicht Kontrolleur(?)Manchmal ja manchmal nein',
     None,
     None, None),
    (
     'U7 direction Rudow Gneisenaustrasse',
     'Gneisenaustraße',
     'U7',
     'Rudow'),
    (
     'JaumeU7 direction Rudow GneisenaustrasseSind auf dem Gleis dort',
     'Gneisenaustraße', 'U7',
     'Rudow'),
    (
     'U7 Gneisenaustr, jetzt Richtung Rudow',
     'Gneisenaustraße',
     'U7',
     'Rudow'),
    (
     'Gelbe Westen S5 Bellevue. Gerade ausgestiegen',
     'Bellevue',
     None,
     None),
    (
     'Tram station bersarinplatz/weidenweg 21 stehen ein paar oa und Polizei...keine Ahnung.einfach Augen auf',
     None, None, None),
    (
     'ZoraDie sehen eher nach Security aus und nicht nach Kontrolle?grüne weste ist kontrolleur bei der s-bahn steht auch hinten drauf',
     None, None, None),
    (
     'u7, adenauer platz, berlin Ab-ticket, noch ne Stunde gültig. Inne Maschine gelassen',
     'Konrad-Adenauer-Platz',
     'U7',
     None),
    (
     'Die haben mich eben kontrolliert die haben diese neuen Geräte Handys bei der BVG jetzt auch auf der M 10  jetzt gerade Kaffeepause',
     None, None, None),
    (
     'Ali ModoPhoto, Die haben mich eben kontrolliert die haben diese neuen Geräte Handys bei der BVG jetzt auch auf der ...Ja, ihr müsst jetzt richtig drauf achten man erkennt die nicht mehr so schnell die haben schon letzte Woche auf dem Bus kontrolliert mit diese neue Geräte !!!!!!!!!!',
     None, None, None),
    (
     'U9 richtig osloerstr.',
     None, 'U9',
     'Osloerstraße'),
    (
     '2 blauwesten w. gelesen. ',
     None, None, None),
    (
     'Grade amruner str. ausgestiegen',
     'Amrunerstraße',
     'S7', None),
    (
     'U5 - Brandenburg Tor',
     'Brandenburger Tor',
     'U5',
     None),
    (
     'U9 in Osloerstr. ausgestiegen',
     'Osloerstraße',
     None,
     None),
    (
     'zwei Blauwesten-Muttis U9, steigen gerade Leo aus. Eine (groß, lange schwarze Haare) hat die Weste nicht an, sondern trägtvsie über dem Arm',
     'Leopoldplatz', None,
     None),
    (
     '4 bos westen märkisches museum, kontrollieren auf dem Bahnhof gerade, richtung pankow',
     'Märkisches Museum',
     'U2', 'Pankow'),
    (
     'Blauwesten u5 Alexanderplatz richtung hönow',
     'Alexanderplatz',
     'U5',
     'Hönow'),
    (
     '2 blauwesten u9 Birkenstr',
     'Birkenstraße',
     'U9',
     None),
    (
     'U9 osloer Richtung Steglitz am Gleis',
     'Osloerstraße',
     'U9',
     'Rathaus Steglitz'),
    (
     'Steigen ein',
     None, None, None),
    (
     'Schöneberg KerstinJa, ihr müsst jetzt richtig drauf achten man erkennt die nicht mehr so schnell die haben schon letzt...Sind das irgendwelche besonderen Geräte ?',
     None, None, None),
    (
     '3 Blauwesten Frankfurter Allee U5 Richtung Hbf.',
     'Frankfurter Allee',
     'U5',
     'Hauptbahnhof'),
    (
     '2 weitere Personen warten noch bei Frankfurter Allee U5',
     'Frankfurter Allee',
     'U5',
     None),
    (
     '2 Blauwesten u5 Richtung Alexanderplatz gleich Frankfurter Tor',
     'Frankfurter Tor',
     'U5',
     'Hauptbahnhof'),
    (
     'Waren 3 und sind Frankfurter Tor ausgestiegen.',
     'Frankfurter Tor',
     'U5', None),
    (
     '2 Blaue jetzt im Zug, Weberwiese raus',
     'Weberwiese',
     'U5', None),
    (
     'U5',
     None, 'U5',
     None),
    (
     'ca 10 leute mit bos westen, wittenbergplatz auf dem Gleis, warten für u2 nach pankow glaube ich',
     'Wittenbergplatz',
     'U2',
     'Pankow'),
    (
     'kontrolle u8 richtung hermannplatz grade jannowitz zwei männlich gelesen, eine weiblich gelesene person alles mit b.o.s. uniform bzw westen. ziemlich weit hinten von der bahn',
     'Jannowitz Brücke',
     'U8',
     'Hermannplatz'),
    (
     'U8 Jannowits',
     'Jannowitz Brücke',
     'U8',
     None),
    (
     'Blaue Jacke Turmstraße u 9 Richtung Osloer 1 weiblich gelesene Mensch',
     'Turmstraße',
     'U9',
     'Osloerstraße'),
    (
     '3 Gelbwesten hermannplatz gerade eingestiegen in die u7 richtung rathaus spandau',
     'Hermannplatz',
     'U7',
     'Rathaus Spandau'),
    (
     'U7, Neukölln, in Uniform',
     'Neukölln',
     'U7',
     None),
    (
     '4 balue Westen in U8 jannowitzbruecke',
     'Jannowitz Brücke',
     'U8',
     None),
    (
     'Mo4 balue Westen in U8 jannowitzbrueckeSind insgesamt zehn in verschiedenen Wagen. Jetzt Heinrich Heine Richtung Hermannstraße.',
     'Heinrich-Heine-Straße',
     'U8',
     'Hermannstraße'),
    (
     'U9 amrumer Richtung zoo',
     'Amrumerstraße',
     'U9',
     'Rathaus Steglitz'),
    (
     'U9 Westhafen stehen Blauwesten, konnte beim Rausgehen aber nicht erkennen, was sie genau machen...',
     'Westhafen',
     None,
     None),
    (
     'U6 Paradestraße',
     'Paradestraße',
     'U6',
     None),
    (
     'U8 Hermanplatz',
     'Hermannplatz',
     'U8',
     None),
    (
     'Gerade Haltestelle Reichartstraße',
     'Reichartstraße',
     None, None),
    (
     'U9 Richtung Rathaus Steglitz jetzt Amrumer Str',
     'Amrumerstraße',
     'U9',
     'Rathaus Steglitz'),
    (
     'Westhafen ausgestiegen',
     'Westhafen',
     None, None),
    (
     'U9 amrumer str, Blauwesten am Bahnsteig',
     'Amrumerstraße',
     'U9',
     None),
    (
     'U8 Richtung Wittenau 2 männlich gelesen 1 weiblich gelesen steigen jetzt in Schönleinstr aus',
     'Schönleinstraße',
     'U8',
     'Wittenau'),
    (
     'U5 weberwiese 2 Blau veste +1 more in normal clothes',
     'Weberwiese',
     'U5',
     None),
    (
     '',
     None, None, None),
    (
     'hauptbahnhof',
     'Hauptbahnhof',
     None, None),
    (
     'soniarichtung?.',
     None, None, None),
    (
     'U6 Richtung alt mariendorf, grade ulsteinstr. 2 männlich, schwarze jacke',
     'Ulsteinstraße',
     'U6',
     'Alt-Mariendorf'),
    (
     'U2 Kloster Str 5 Personen Ticket Kontrolle',
     'Klosterstraße',
     'U2',
     None),
    (
     'U2 Klosterstraße 5 Personen Ticket Kontrolle',
     'Klosterstraße',
     'U2',
     None),
    (
     'PuroxuIch dachte DB streikt, oder nicht? ',
     None, None, None),
    (
     'Also wieso an der Sbhn Kontrollen haben?Notfallfahrplan ;) die Regios die fuhren wurden auch alle Kontrolliert. Zugbegleiter und Kontrollpersonal sind halt nicht in der GDL.',
     None, None, None),
    (
     'Kontrolle in der u8 richtung wittensu bei der janowitzbrücke',
     'Jannowitz Brücke',
     'U8',
     'Wittenau'),
    (
     'Sind teilweise ausgestiegen.',
     None, None, None),
    (
     'Sbahn fährt wieder normal wird garnicht kontrolliert ?',
     None, None, None),
    (
     'U6 naturkundemuseum Richtung Kurt Schumacher',
     'Naturkundemuseum',
     'U6',
     'Alt-Tegel'),
    (
     'Blauwesten',
     None, None, None),
    (
     'Sind gerade raus',
     None, None, None),
    (
     '2x',
     None, None, None),
    (
     'Keine Kontis auf em sbahn oder? Es scheint nicht 🤔',
     None, None, None),
    (
     'U7 Wilmersdorf ausgestiegen',
     'Wilmersdorferstraße',
     None,
     None),
    (
     'Leopoldplatz -> Alt Tegel blauvesten',
     'Leopoldplatz',
     None, 'Alt-Tegel'),
    (
     'U2 Gleisdreieck platform direction Pankow',
     'Gleisdreieck',
     'U2',
     'Pankow'),
    (
     'U2 Alex - 2 x Blauwesten',
     'Alexanderplatz',
     'U2',
     None),
    (
     '3 guys with yellow jacket U5 Museuminsel Hönow',
     'Museumsinsel',
     'U5',
     'Hönow'),
    (
     '2 guys with yellow jackets in U8 Hermannstr',
     'Hermannstraße',
     'U8',
     None),
    (
     'PhilKeine Kontis auf em sbahn oder? Es scheint nicht 🤔Faehrt auch noch keine wegen streik',
     None, None, None),
    (
     'U6 Schumacher-Platz merhingdam',
     'Mehringdamm',
     'U6',
     'Kurt-Schumacher-Platz'),
    (
     'U8 alex richtung wittenau',
     'Alexanderplatz',
     'U8',
     'Wittenau'),
    (
     '',
     None, None, None),
    (
     'U8 Alexanderplatz Richtung Wittenau',
     'Alexanderplatz',
     'U8',
     'Wittenau'),
    (
     '',
     None, None, None),
    ("Miguel GalindoPhotothey're at heinrich heine now", 'Heinrich-Heine-Straße',
     'U8', None),
    (
     'U6 tempelhof ',
     'Tempelhof',
     'U6',
     None),
    (
     '4 with yellow vests at platform',
     None, None, None),
    (
     'U9 Richtung Osloer Straße, 4 people auf Bahnsteig.',
     None, 'U9',
     'Osloerstraße'),
    (
     '/line U1, U3 Kontrolle die sind 3 Männer mit schwarze Jacke',
     None, 'U3',
     None),
    (
     'U1/U3 schlesisches Tor in 3 Kontrolletis in Security Westen',
     'Schlesisches Tor',
     None,
     None),
    (
     'Richtung Uhlnd Straße',
     None, None, 'Uhlandstraße'),
    (
     '4 BOS U9 Zoo on the platform',
     'Zoologischer Garten',
     'U9',
     None),
    (
     'stehn u7 berliner Straße/Richtung Rathaus Spandau, circa 3-4 Leute mit Bos Westen',
     'Berlinerstraße',
     'U7',
     'Rathaus Spandau'),
    (
     'u1 nach warschauer gerade görli eingestiegen',
     'Görlitzer Bahnhof',
     'U1',
     'Warschauerstraße'),
    (
     'U8 Pankstraße nach Wittenau blaue Westen',
     'Pankstraße',
     'U8',
     'Wittenau'),
    (
     'U8 Pankstraße nach Hermannstraße auch blau Westen',
     'Pankstraße',
     'U8',
     'Hermannstraße'),
    (
     'Sind in die U Bahn gestiegen',
     None, None, None),
    (
     'Blue vest at weinmesterstr. U8',
     'Weinmeisterstraße',
     'U8',
     None),
    (
     '5 blauwesten weinmeister straße',
     'Weinmeisterstraße',
     'U8', None),
    (
     'U8',
     None, 'U8',
     None),
    (
     '2 blaue Westen U8 Richtung hermannstrasse',
     None, 'U8',
     'Hermannstraße'),
    (
     '3 Personen u- Pankow Right Ruhl.',
     'Pankow',
     None, 'Ruhleben'),
    (
     '1weibl gel. 2männl. Gel. In BVG Uniform',
     None, None, None),
    (
     'U7 megringdamm Richtung Rathaus spandau, 2 gelbe Westen',
     'Mehringdamm',
     'U7',
     'Rathaus Spandau'),
    (
     'U2 klosterstraße 2 in blau 1mal männlich,ein mal weiblich',
     'Klosterstraße',
     'U2',
     None),
    (
     'u7 richtung rathaus spanda, ca 5 mit bos westen und 2 mit bvg sicherheit sind mierendorff raus. männl gelesen.',
     'Alt-Mariendorf',
     'U7',
     None),
    (
     'U3 Richtung krumme lanke Wittenbergplatz',
     'Wittenbergplatz',
     'U3',
     'Krumme Lanke'),
    (
     'U2 mohrenstr. Rictung ruhleben',
     'Mohrenstraße',
     'U2',
     'Ruhleben'),
    (
     'Kontrolleur*innen warten am Ausgang S-Mahlsdorf',
     'Mahlsdorf',
     'S5', None),
    (
     'U2 Bülowstraße platform direction Ruhleben',
     'Bülowstraße',
     'U2',
     'Ruhleben'),
    (
     '3 manner  in U bismarkstr  Bos Westen',
     'Bismarckstraße',
     None, None),
    (
     'MarisaPhoto, Kontrolleur*innen warten am Ausgang S-MahlsdorfDie sehen eher nach Security aus und nicht nach Kontrolle?',
     None, None, None),
    (
     'ZoraDie sehen eher nach Security aus und nicht nach Kontrolle?Auf deren Westen steht doch Prüfpersonal ich kenne die, die kontrollieren in der S-Bahn',
     None, None, None),
    (
     'Ich dachte DB streikt, oder nicht? ',
     None, None, None),
    (
     'Also wieso an der Sbhn Kontrollen haben?',
     None, None, None),
    (
     'Hat jemand Lust meine Theaterkarten HEUTE um 17 Uhr in der Schaubühne zu nutzen? Bin verhindert und kann nicht hin. Verschenke sie!',
     None, None, None),
    (
     'Di NorrHat jemand Lust meine Theaterkarten HEUTE um 17 Uhr in der Schaubühne zu nutzen? Bin verhindert und ...2x',
     None, None, None),
    (
     'Di NorrHat jemand Lust meine Theaterkarten HEUTE um 17 Uhr in der Schaubühne zu nutzen? Bin verhindert und ...https://t.me/+SfbQrVVRAOpyQhcH ',
     None, None, None),
    (
     'Sharing is caring Gruppe ',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'https://t.me/Veranstaltungen_BLN',
     None, None, None),
    (
     'Veranstaltungen',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'Vielleicht wirst du die hier los :)',
     None, None, None),
    (
     'U9 Kontrolle 2x bos',
     None, 'U9',
     None),
    (
     'Ri Steglitz',
     None, None, 'Rathaus Steglitz'),
    (
     'Wo gesichtet?',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'U-Bahn Hof zoologischer',
     'Zoologischer Garten',
     None, None),
    (
     'Beide sind ausgestiegen haben eine junge Frau rausgezogen',
     None, None, None),
    (
     'U6 kochstrase',
     'Kochstraße (Checkpoint Charlie)',
     'U6',
     None),
    (
     'Sorry it was a wolt false alarm XD',
     None, None, None),
    (
     'U7 berliner str. Min. 10 Kontis gesehen. Ri. Rudow',
     'Berlinerstraße',
     'U7',
     'Rudow'),
    (
     'U6 Tempelhof am Gleis Richtung Alt Tegel',
     'Tempelhof',
     'U6',
     'Alt-Tegel'),
    (
     'ZoraDie sehen eher nach Security aus und nicht nach Kontrolle?Das ist "Prüfpersonal" - die kontrollieren. Hab ich dann auch noch mitbekommen.',
     None, None, None),
    (
     'u6 mehringdamm',
     'Mehringdamm',
     'U6',
     None),
    (
     'blaue kötter Westen',
     None, None, None),
    (
     'fünf Personen',
     None, None, None),
    (
     'U2 Pankow. Zoologischer Garden',
     'Zoologischer Garten',
     'U2',
     'Pankow'),
    (
     '3 männlich gelesene stehen am Gleis nollendorfplatz Richtung krumme lanke',
     'Nollendorfplatz',
     None, 'Krumme Lanke'),
    (
     'U8 richtung Hermanplatz',
     None, 'U8',
     None),
    (
     'rosa luxemburg platz u2 pankow direction',
     'Rosa-Luxemburg-Platz',
     'U2',
     'Pankow'),
    (
     'MarsPhoto, U8 richtung hermanplatzHaben die kontrolliert? Ne, oder?',
     None, None,
     None),
    (
     'U8 kotti polizei kontrol..',
     'Kottbusser Tor',
     'U8',
     None),
    (
     'Ich dachte security kontrollieren nicht.',
     None, None, None),
    (
     '4 bluevest alex u8 wittenau',
     'Alexanderplatz',
     'U8',
     'Wittenau'),
    (
     'U2 Zoo 2 polizei 2 bvg Sicherheit stehen auf dem Gleis Richtung ruhleben',
     'Zoologischer Garten',
     'U2',
     'Ruhleben'),
    (
     '2 Blauwesten gerade in der U8, sind Voltastr. drin geblieben. Richtung Wittenau.',
     'Voltastraße',
     'U8',
     'Wittenau'),
    (
     'Mon2 Blauwesten gerade in der U8, sind Voltastr. drin geblieben. Richtung Wittenau.Jetzt noch 2 andere ohne Westen an der U8 Pankstr.',
     'Pankstraße',
     'U8',
     'Wittenau'),
    (
     'U8 gesundbrunnen auf dem Gleis stehen welche und kontrollieren',
     'Gesundbrunnen',
     'U8',
     None),
    (
     'Bananen Kisten  5x abzuholen  Gesundbrunnen',
     'Gesundbrunnen',
     None, None),
    (
     'Magic BeamBananen Kisten  5x abzuholen  GesundbrunnenBitte in die foodsharing Gruppe',
     'Gesundbrunnen',
     None, None),
    (
     'https://t.me/foodsharing_berlin',
     None, None, None),
    (
     '19:04 uhr, weitergeleitet:',
     None, None, None),
    (
     '',
     None, None, None),
    (
     '"U6 Paradestraße',
     'Paradestraße',
     'U6',
     None),
    (
     'Wahrscheinlich Richtung Kurt-Schumacher Platz',
     None, None, 'Kurt-Schumacher-Platz'),
    (
     '2 Blauwesten"',
     None, None, None),
    (
     'Diskussion zur Kontrollberechtigung in die Diskussionsgruppe verschoben',
     None, None, None),
    (
     'U8 leinestrasse, wittenau direction, 4 people',
     'Leinestraße',
     'U8',
     'Wittenau'),
    (
     'U8 Jannowitzbrükcke (2 leute)',
     'Jannowitz Brücke',
     'U8',
     None),
    (
     '[Bea] 🌎Ich dachte security kontrollieren nicht.Kontrollieren auch nicht',
     None, None, None),
    (
     'Könnt ihr zum Quatschen bitte in die @Diskussionsgruppe gehen?',
     None, None, None),
    (
     'Nachrichten wieder gelöscht.',
     None, None, None),
    (
     'AKönnt ihr zum Quatschen bitte in die @Diskussionsgruppe gehen?',
     None, None, None),
    (
     'Nachrichten wieder gelöscht.Oki ☺️',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'U8 Heinrich Heine ausgestiegen',
     'Heinrich-Heine-Straße',
     None,
     None),
    (
     'Kontrollieren die mittlerweile samstags?',
     None, None, None),
    (
     'MaxKontrollieren die mittlerweile samstags?Ja immer',
     None, None, None),
    (
     'Berliner strasse u7 gleis richtung rudow',
     'Berlinerstraße',
     'U7',
     'Rudow'),
    (
     'Schöneberg KerstinJa immerOk danke',
     'Schöneberg',
     None, None),
    (
     'Bitte hier keine Fragen, ob diese oder jene Linie gerade frei ist, sondern stattdessen die Suchfunktion (das Lupensymbol) nutzen. Danke! Nachricht gelöscht.',
     None, None, None),
    (
     'U8 pankstr richtung Hermannstr',
     'Pankstraße',
     'U8',
     'Hermannstraße'),
    (
     'U2 nach ruleben 4 Kontrolleurs',
     None, 'U2',
     'Ruhleben'),
    (
     'Ausgestiegen',
     None, None, None),
    (
     '3 gelbe westen S9 am Trepi Richtung Friedrichstraße',
     'Treptower Park', 'S9',
     'Spandau'),
    (
     'U2 zoo richtung Ruhleben',
     'Zoologischer Garten',
     'U2',
     'Ruhleben'),
    (
     'Eine in komplett schwarz mit schwarzen haaren, die andere mit beiger Jacke und braunen Haaren, beide solar ihm gebräunt',
     None, None, None),
    (
     '',
     None, None, None),
    (
     'Sind jetzt Betriebshof Marzahn ausgestiegen.',
     'Marzahn',
     'S7', None),
    (
     'unter den linder 2 personas',
     'Unter den Linden',
     None, None),
    (
     'Mmmykolaunter den linder 2 personasRichtung?',
     None, None, None),
    (
     'Bundesbullen am Alex oben im Bahnhof',
     'Alexanderplatz',
     None, None),
    (
     'tacco (she/her)Photo, Bundesbullen am Alex oben im BahnhofU oder S',
     'Alexanderplatz',
     None, None),
    (
     '4 Blauwesten U Bismarckstraße. Richtung Pankow',
     'Bismarckstraße',
     None, 'Pankow'),
    (
     'S Bahn',
     None, None, None),
    (
     'Schöneberg KerstinU oder SS Bahn',
     'Schöneberg',
     None, None),
    (
     'Blauwesten ErnstReuter jetzt Richtung Zoo',
     'Ernst-Reuter-Platz',
     'U2', 'Pankow'),
    (
     'Schöneberg KerstinU oder SLaut Bild am Übergang zwischen S- und U-Bahn, auf Erdgeschoss-Ebene (kann ja z.B. für Menschen mit Screenreader wichtig sein, dass das in Textform da steht - bloß mal so als Anmerkung).',
     'Schöneberg',
     None, None)
]
