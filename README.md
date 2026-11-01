# RIVA

Esplorazione 3D in prima persona su una spiaggia fuori stagione. Reale, ma emotiva ed evanescente. Grafica e palette prese dalle foto di riferimento: cielo blu profondo al mattino, acqua turchese e trasparente sulla riva, tramonto con la fascia rosa sul mare, cielo viola‑grigio e sabbia arancio.

## Avvio
```
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Gira nel browser con Three.js incluso in `vendor/`, senza build.

## Comandi
- WASD / frecce: cammina, nuota, pagaia · Mouse: guarda · Shift: corri / nuota più forte
- Spazio: salta, o risali quando sei sott'acqua · C: immergiti
- E: azione (moto, SUP, barchino, deltaplano, sali a bordo, scalette, maschera e pinne, panchine)
- F: fluire (quando la storia te lo concede) · Q: piovi, quando sei nuvola · B: torna corpo, lì dove sei
- N: mappa (piccola / grande)
- T: fase successiva del giorno · J: diario · M: audio on/off
- Touch: metà sinistra per muoverti, metà destra per guardare, tasti SU / GIÙ / AZIONE / ORA / DIARIO

## Cosa c'è
**Ambiente**
- Ciclo giorno/notte completo in 12 minuti (notte, alba, mattino, mezzogiorno, pomeriggio, ora dorata, tramonto, crepuscolo). Cielo, luce, nebbia e color grading cambiano insieme. Di notte ci sono stelle e luna.
- Nuvole vere: cumuli e cirri che si muovono e cambiano copertura nel tempo. Le loro ombre corrono su sabbia e mare.
- Foschia mattutina e notturna che sale sull'orizzonte.
- Orizzonte a strati: catena lontana, promontorio, colline, porto con gru e ciminiera, un'isola appena visibile. Le sagome sono morbide e velate, senza poligoni a vista, e restano sempre alla stessa distanza.
- Spiaggia infinita: cumulo di sabbia, fascia di ciottoli, sabbia bagnata. Increspature del vento sulla sabbia asciutta e onde di sabbia sul fondale.
- Ciottoli, conchiglie e legnetti in 3D sparsi attorno a te.
- L'acqua passa dal turchese trasparente al blu profondo. Ci sono caustiche sul fondale, schiuma, riflessi delle nuvole e scintille del sole.
- Post-processing: bloom, raggi di luce dal sole (god rays), lens flare, grana e vignettatura.

**Esplorazione: tutto quello che può fare una persona**
- **Camminare**, anche nell'acqua bassa: più è alta più rallenti, con schizzi e cerchi sull'acqua.
- **Nuotare** dove non si tocca, a pelo d'acqua, con il suono delle bracciate.
- **Immergersi** (C): sotto la superficie tutto diventa ovattato, la luce scende a fasci e dall'alto si vede la finestra del cielo. Il respiro è limitato. Senza maschera si vede sfocato.
- **Maschera e pinne**: le trovi davanti a una cabina dello stabilimento. Con la maschera vedi nitido sott'acqua, con le pinne nuoti più veloce e resti sotto più a lungo.
- **Moto da enduro**: parcheggiata sul lungomare. Con E ci sali, W accelera, A e D sterzano. Ti porta su per le colline fino al belvedere. Di notte accende il faro.
- **Barchino a motore**: legato in fondo al pontile. Ti porta veloce al largo.
- **Navi raggiungibili**: la barca a vela e il traghetto navigano davvero. Quando ti avvicini gettano l'ancora: con E sali a bordo (dall'acqua, dal SUP o dal barchino) e cammini sul ponte. Per tornare in acqua, ti tuffi.
- **Deltaplano**: è sul crinale vicino al belvedere. Con E decolli. W picchia, S cabra, A e D virano. Le termiche sulle colline e il vento sui pendii ti sollevano; atterri su sabbia, prato o in acqua.
- **SUP**: la tavola è sulla sabbia davanti allo stabilimento. Con E la spingi in acqua e ci sali, poi pagai fino al largo. Quando scendi resta dove l'hai lasciata.
- **Fondale vivo**: prati di posidonia che ondeggiano, banchi di salpe che si allontanano se ti avvicini, scogli con ricci.
- **Gabbiani**: alcuni volano alti e planano, altri riposano su sabbia e pali del pontile e si alzano in volo se ti avvicini. Si sentono, e la voce si sposta nello spazio.
- **Luce**: c'è una foschia solare, un velo luminoso attorno al sole quando l'aria è umida. Le nuvole fanno ombra, la pergola disegna strisce sulla sabbia.
- Impronte che svaniscono, panchine (E) dove il tempo scorre più veloce, suono dei passi.

**Luoghi (tutti reali, un po' dimenticati)**
- Le colline e le montagne dietro la spiaggia, vere e raggiungibili: erba secca, macchia, pini marittimi, roccia sui pendii.
- Il belvedere in collina: muretto a secco, una panchina rivolta al mare, un vecchio cipresso.
- La foce: un canale d'acqua bassa che taglia la sabbia e riflette il cielo.
- Il chiosco chiuso sotto la pergola: le travi disegnano strisce d'ombra sulla sabbia.
- Il pontile di legno che entra nel mare. Ci si cammina sopra fino in fondo.
- Lo stabilimento chiuso per la stagione: cabine colorate, lettini impilati, la torretta del bagnino.
- Una barca da pesca tirata in secco.
- La scogliera di massi, su cui si può salire.
- Il lungomare: muretto basso e palme mosse dal vento.
- La passerella con la bandiera rossa mossa dal vento, la piattaforma offshore con le boe.

**Esplorazione libera e scoperte**
- **Il vecchio molo industriale**, oltre lo stabilimento: rampa, campate di cemento su piloni arrugginiti, binari, bitte, un nastro trasportatore in parte crollato, due campate cadute in mare (si scende in acqua e si risale con le scalette) e una gru a portale in fondo, su cui si sale.
- **Il capannone**, con il tetto sfondato: la luce entra a fasce. Dentro c'è un registro.
- **La piattaforma** in mare è esplorabile: scaletta dal mare, ponte inferiore e superiore, e una radio ancora accesa.
- **Il relitto** di una barca da pesca sul fondo davanti al molo. Poi **delfini** che saltano al largo, una **tartaruga** che nuota accanto a te sott'acqua e **stelle cadenti** di notte.
- **Scoperte**: si trovano vagando, senza ordine obbligato, e finiscono nel diario. Alcune portano ad altre: il registro porta alla radio, la radio al relitto (sulla mappa compare una zona azzurra).
- **Fluire**: il relitto accende un pensiero, e da quel momento in acqua puoi **diventare il mare** (F, su telefono FLUISCI). Scorri veloce sopra e sotto la superficie, con Spazio sollevi un'onda che si allarga, e quando arrivi a riva l'onda si scioglie e torni corpo.

**Le forme: trasferirsi nelle cose, in un pensiero**
- **Le forme le decide la storia**: ogni ricordo trovato ti trasforma nella cosa giusta per arrivare al successivo, sempre nel punto in cui sei. Non ci sono cambi di forma a caso.
- **Gabbiano**: lo sguardo guida la quota, A e D virano, Spazio batte le ali. **Sabbia**: scivoli dove va il vento; se tocchi l'acqua diventi acqua. **Onda**: corri verso riva e ti rompi sulla sabbia, dove arrivi. **Nuvola**: Q per scendere come pioggia.
- B (su telefono CORPO) ti fa tornare umano proprio dove sei, mai nel punto da cui eri partito.

**Al largo**
- Una zattera ancorata (si sale con la scaletta), una boa di segnalazione che lampeggia di notte, meduse che pulsano a mezz'acqua, delfini che ti nuotano accanto quando sei in mare.

**Mappa**
- Frecce sul bordo verso il prossimo ricordo e la prossima scoperta, con la distanza. Zoom con la rotella, i tasti + e −, o i pulsanti quando è ingrandita.

**Contatto con l'acqua**
- Spruzzi quando ti tuffi o sollevi un'onda, gocce sull'obiettivo quando riemergi.

**Fisicità**
- Niente più oggetti attraversati: tronchi, palme, pali del pontile, piloni del molo, gambe della piattaforma, pergola, torretta, muretto del belvedere, navi, moto e barchino sono ostacoli veri. La moto e il barchino ci sbattono e rimbalzano.
- Atterrando da un salto lo sguardo si abbassa e risale; le salite ripide rallentano, quelle troppo ripide non si scalano.
- Scie nell'acqua: barchino, SUP, nuoto, Fluire, guado e moto in acqua lasciano onde che si allargano e una scia di schiuma sfilacciata che svanisce.

**Eco**
- La prima volta che entri in un luogo riaffiora un piccolo ricordo, a margine (il pontile, la foce, le cabine, il molo, il largo...).

**Materiali e superfici**
- Pini marittimi con chiome di aghi, rami e corteccia; macchia a foglie; ciuffi d'erba sulle dune e prati secchi sulle colline, tutti mossi dal vento.
- Granelli di sabbia che scintillano controsole; la fascia di posidonia secca con le palline di fibra lungo la linea dove arriva il mare.
- Sabbia con grana a più scale; la sabbia bagnata è lucida e specchia il cielo, con piccole pozze.
- Moto con plastiche, metalli e gomme con micro-variazioni e un velo di polvere, sella con la sua trama. Sulla sabbia morbida affonda, rallenta e scoda; lascia solchi delle gomme (che il mare cancella) e alza spruzzi di sabbia.
- Ruggine, cemento macchiato e mattoni per le strutture industriali.

**Vento, mare e cielo**
- Il vento gira piano e va a raffiche: chiazze increspate corrono sull'acqua, la sabbia scivola a terra, palme e macchia si piegano, il suono del vento segue le raffiche.
- Risacca vera: le onde si gonfiano sul fondale basso, si rompono, diventano schiuma a merletto e risalgono la sabbia in una lama d'acqua sottile che poi si ritira.
- Cumuli con la base scura e, in certi momenti, il cielo a pecorelle che vela la luce.
- Una barca a vela e un traghetto passano lenti all'orizzonte.
- Luce riflessa dal cielo su tutti i materiali; sassi, cespugli e scogli con superfici levigate.
- Mezzi disegnati con cura: scafi a sezioni vere con insellatura e carena, coperta in teak, tientibene in acciaio, vele con profilo; enduro con telaio a tubi, forcella dorata e gomme tassellate; deltaplano con vela profilata.

**Storia: una catena di ricordi**
- Fine settembre. Qualcuno ha dimenticato una giornata intera su questa spiaggia. L'obiettivo è sempre a schermo, sotto l'orologio: *ritrova i ricordi, ognuno ti porterà al prossimo*.
- Ogni ricordo è un oggetto vero (candela, libro, sandali, orologio sul fondo, cappello, lettera, lanterna, bottiglia a bordo della barca a vela, binocolo al belvedere). Quando lo trovi arriva un'**illuminazione**: la luce si fa calda, torna il ricordo, poi parte un **pensiero** che indica dove andare.
- Una piccola luce si stacca dall'oggetto e vola verso il prossimo luogo; sulla mappa compare una zona tratteggiata. Il ricordo successivo esiste solo da quel momento.
- Il percorso usa tutti i modi di muoversi: a piedi, sul pontile, sott'acqua con la maschera, in barchino o SUP fino alla barca a vela, in moto sulle colline, in deltaplano per scendere. Quando serve, un pensiero suggerisce come arrivarci.
- Il diario (J) conserva ogni ricordo con il suo pensiero. Alla fine, alla bandiera, c'è qualcuno che ti aspetta.

**Ogni ricordo ti cambia forma**
Dopo il pensiero diventi, nel punto esatto in cui sei, la cosa giusta per arrivare al ricordo successivo: umano → aria → vento e sabbia → acqua → pesce → onda → nuvola → pioggia → gatto → umano con i mezzi → gabbiano → deltaplano → luce.
1. Il vasetto con la candela, trovato a piedi → **gabbiano**: dall'alto vedi le travi del chiosco.
2. Il libro → **sabbia**: il vento ti porta verso il pontile; quando tocchi l'acqua diventi **acqua** (Fluire).
3. I sandali, in fondo al pontile → **pesce**: scendi verso l'orologio sul fondo e vedi nitido.
4. L'orologio → **onda**: corri verso riva e pieghi verso la torretta.
5. Il cappello → **nuvola**: sopra la barca in secco scendi come **pioggia** (Q) e tocchi terra.
6. La lettera → **gatto**: leggero tra i sassi, fino alla punta degli scogli.
7. La lanterna → di nuovo **umano**: per il largo servono un barchino o un SUP.
8. La bottiglia, a bordo della barca a vela → **gabbiano**, fino al cipresso sulle colline.
9. Il binocolo → **deltaplano** verso la bandiera. Dopo l'incontro diventi **luce**, poi resti libero di esplorare.
- Sulla mappa c'è solo il prossimo ricordo, verde e pulsante, con una freccia che lo indica; quelli già trovati spariscono. Nel mondo una colonna di luce verde lo segnala da lontano.
- In ogni luogo del ricordo succede qualcosa: la luce si libera a spirale, e poi la candela alza la sabbia e i gabbiani, il libro e la lettera volano via nel vento, il cappello se lo porta il vento, l'orologio riprende a ticchettare tra le bolle, la lanterna illumina tutto, il binocolo avvicina lo sguardo.
- Ogni trasformazione è annunciata («Qualcosa cambia…»), avviene lenta in una luce chiara, e poi un pensiero spiega perché sei quella cosa e cosa devi cercare.

**Il viaggio dell'acqua (l'isola)**
- Da nuvola vedi il mondo nitido: in alto l'aria è più limpida.
- Al largo c'è un'isola vera, secca. Portaci la nuvola e piovi (Q): la terra beve e in pochi istanti nascono erba, macchia, fiori e pini.
- Un petalo si stacca e tu con lui: il vento ti porta verso la barca a vela, ferma senza vento. Lì diventi **vento**: radente e veloce, increspi l'acqua. Soffia nelle vele e la barca riparte, inclinata, verso casa.

- In alto al centro c'è una freccia lieve verso il prossimo ricordo, con la distanza e un puntino per ogni ricordo (pieni quelli trovati).
- Da Fluire, ogni onda sollevata subito dopo l'altra è più grande.

**Suoni delle forme**
- Gabbiano: colpi d'ala e aria. Pesce e Fluire: acqua che scorre e bolle. Onda: un rombo che cresce. Sabbia: granelli che scorrono. Pioggia: fruscio e gocce. Albero: foglie e legno che scricchiola, il mondo sotto un po' attutito. Nuvola: tutto lontano e ovattato. Gatto: zampe quasi silenziose e fusa. Luce: un accordo lieve.
- Passi diversi su sabbia asciutta, sabbia bagnata, legno, cemento, scoglio, erba e acqua.

**Luce sott'acqua e ombre**
- Più scendi, meno luce: il rosso sparisce per primo, i raggi dalla superficie si spengono in profondità, vicino alla superficie le caustiche tremano sul primo piano. Il pulviscolo marino galleggia attorno a te.
- La risacca disegna una lama d'acqua a lobi: ogni onda arriva diversa, sale, rallenta e si ritira lasciando la sabbia scura e lucida, che poi asciuga.
- Le ombre seguono lo sguardo e si allargano quando voli (gabbiano, deltaplano, nuvola), così il paesaggio sotto ha sempre le sue ombre.

## Parametri di debug (URL)
`?t=0.75` per l'ora (0–1), `&x=..&z=..&yaw=..&pitch=..` per la posizione, `&freeze` per fermare il tempo, `&clouds=0.5` per fissare le nuvole, `&gear` per avere maschera e pinne, `&mode=swim|dive|sup|bike|boat|glide|flow`, `&alto=1` per il cielo a pecorelle, `&flow&forms=gull,tree,sand,wave,cloud` per avere tutte le forme per partire in acqua, `&autostart` per saltare la schermata iniziale.
