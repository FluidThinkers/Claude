# RIVA in Unity HDRP — piano di porting

Questo file è per la sessione Claude Code locale, sul Mac con Unity aperto e collegato via MCP.
- Prototipo web: `~/Riva/prototipo`
- Progetto Unity: `~/Riva/RivaUnity` (Unity 6.6, HDRP 17.6, MCP for Unity)

## Principio
Non si traduce il codice riga per riga. Il prototipo web è **il progetto di design**: dice com'è fatto il mondo, cosa si prova, come si muovono le forme. In Unity si ricostruisce con gli strumenti nativi di HDRP, che fanno da soli molto di quello che nel web era scritto a mano.

| Nel prototipo web | In Unity HDRP |
|---|---|
| shader del mare scritto a mano (`src/shaders.js`, `src/sea.js`) | **HDRP Water System**: Ocean con onde, schiuma, caustiche, sott'acqua, riflessi |
| cielo, sole, luna, stelle (`shaders.js`, `palette.js`) | **Physically Based Sky** + **Volumetric Clouds** + luna come seconda Directional Light |
| nebbia e foschia | **Volumetric Fog** (Volume) |
| post-processing (bloom, raggi di luce, grading) | **Volume**: Bloom, Tonemapping ACES, Color Adjustments, Depth of Field, Lens Flare (SRP), Screen Space Lens Flare |
| terreno, sabbia, rocce (`terrain.js`, `places.js`) | **Terrain** con layer PBR (sabbia asciutta, sabbia bagnata, roccia, terra, erba) + Decal per le impronte |
| erba e alberi (`flora.js`) | Terrain Details e Trees con vento HDRP (Wind Zone) |
| spruzzi, pioggia, sabbia nel vento (`particles.js`, `wind.js`) | **VFX Graph** |
| meteo G e vento X (`main.js`: `WEATHER`, `WIND`) | `WeatherController.cs`, che pilota Water, Clouds, Fog, Wind Zone e i parametri VFX |
| barca a vela con vento apparente (`main.js`, blocco sail) | `SailBoat.cs` con Rigidbody e galleggiamento sul **Water System** (query di altezza dell'acqua) |
| forme: gabbiano, pesce, onda, nuvola, vento, pioggia, formica, gatto (`forms.js`) | un `FormController` per forma, sotto un `PlayerForms.cs` comune |
| storia e voce (`story.js`, `main.js`: `say`, `onFind`) | `StoryDirector.cs` + `NarrationPlayer.cs` (coda di frasi, una alla volta, musica abbassata durante la voce) |
| audio (`audio/`) | si copia così com'è: AudioSource 3D + Audio Mixer (gruppi Ambiente, Musica, Voce) |

## Da copiare subito dal prototipo
- `audio/*.mp3`: ambienti (mare, vento, alberi, sott'acqua, fusa, pioggia, notte, gabbiani), tuoni.
- `audio/voce/` (56 frasi + `manifest.json`) e `audio/musica/` (9 cue + `manifest.json`).
- `STORIA-4.md`: la storia di riferimento, il viaggio dell'acqua.
- `screenshots/` e le foto dell'utente: **riferimento visivo** per luce, colori, silhouette delle montagne, strada di luce sul mare.
- La disposizione del mondo dal codice (`src/places.js`, `src/explore.js`, `src/terrain.js`): spiaggia, pontile, torretta del bagnino, gru, relitto, rovina al largo, isola, scogli, colline con il cipresso. Le coordinate si ricavano da lì.

## Cosa lo rende "super fico" (in ordine di impatto)
1. **Luce e cielo.** Physically Based Sky + nuvole volumetriche + esposizione automatica. L'alba ligure, con il sole basso, la strada di luce sull'acqua e le montagne scure in controluce, è metà del gioco.
2. **Il mare HDRP.** Ocean con swell lungo da sud, schiuma sulla battigia, acqua trasparente sotto costa e scura al largo.
3. **Materiali veri.** Texture fotogrammetriche: sabbia, roccia ligure, legno consumato del pontile. Fonti: Fab / Quixel Megascans, Poly Haven, ambientCG (gratis, CC0). Per scaricarle dal Mac serve la rete normale, non la sandbox.
4. **Modelli veri** per animali e barca. Da Asset Store o Fab: gabbiano, pesci (salpa o simili), gatto, formica, barca a vela da 8–10 m. Animazioni incluse. Non si modellano a mano.
5. **VFX Graph:** spruzzi sulla prua e sugli scogli, pioggia con gli anelli sull'acqua, sabbia trascinata dal vento, polline e pulviscolo nel controluce.
6. **Audio spaziale:** risacca posizionata sulla battigia, vento che cambia con la forza, riverbero sott'acqua.
7. **Camera cinematografica.** Cinemachine per i passaggi tra forme e per il finale che sale.

## Tappe
1. **La riva all'alba.**
   - Terreno: spiaggia, colline sullo sfondo, scogli.
   - Mare HDRP, cielo, luce dell'alba, Volume cinematografico.
   - Camera in prima persona che cammina (Input System).
   - Ambiente sonoro di mare e vento.
   - *Obiettivo:* deve già sembrare una foto.
2. **Meteo e vento.**
   - `WeatherController` con i 4 cieli (sereno, velato, nuvoloso, tempesta) e i 5 venti (nessuno, brezza, medio, forte, uragano).
   - Due selettori a schermo.
   - Ciclo del giorno: alba, mattino, mezzogiorno, tramonto, notte con la luna.
3. **I luoghi.** Pontile, torretta del bagnino, gru, relitto, rovina al largo, isola, cipresso: prima segnaposto puliti, poi modelli veri.
4. **La barca a vela.** Galleggiamento sul Water System, vento apparente, scotta, timone, sbandamento, spruzzi a prua.
5. **Le forme**, nell'ordine della storia: pesce (banco con Boids), onda, nuvola, vento, pioggia, formica, gatto.
6. **La storia.**
   - `StoryDirector`: tappe, oggetti-ricordo, pulsante Q, voce, musica per momento, meteo per tappa.
   - Finale con Cinemachine.
7. **Rifinitura e Steam.** Menu, impostazioni grafiche, salvataggio, build per Windows e Mac, Steamworks.

## Regole di lavoro
- **Prima di ogni modifica grande**, salva la scena e fai un commit git.
- **Dopo ogni modifica**, uno screenshot della Game View per verificarla con l'utente.
- **Prestazioni:** 60 fps su Mac Apple Silicon a 1440p. Le impostazioni di qualità vanno in Project Settings → Quality.
- **Lingua:** testi e commenti in italiano, nomi di classi e variabili in inglese.
