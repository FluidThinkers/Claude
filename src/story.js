// La storia: una giornata intera dimenticata su questa spiaggia, a fine settembre.
// I ricordi sono oggetti lasciati lungo la riva. Ognuno, quando lo trovi, accende
// un pensiero, un'illuminazione, che porta al ricordo successivo.
// Solo alla fine si capisce di chi è la giornata, e perché è stata lasciata qui.

export const INTRO = [
  'Fine settembre. Gli ultimi giorni, prima che chiudano tutto.',
  'Qualcuno ha dimenticato una giornata intera su questa spiaggia.',
  'Ritrova i ricordi. Ognuno ti porterà al prossimo.',
];

// Ogni ricordo: l'ora della giornata, l'oggetto, il ricordo, il pensiero che porta oltre,
// e l'obiettivo breve che resta a schermo finché non trovi il ricordo successivo.
export const FRAGMENTS = [
  { label: '06:40', place: 'Un barattolo con una candela', form: 'gull',
    text: 'Accendo la candela prima che faccia giorno. Non serve a vedere: serve a sapere che anche oggi ho trovato la strada.',
    thought: 'La fiamma si piega verso un riparo di travi, dove si leggeva all\'ombra. Da lassù lo vedresti subito.',
    goal: 'L\'ombra delle travi, al chiosco.', become: 'Diventi un gabbiano. L\'aria ti tiene.',
    why: 'Il chiosco è lontano e le sue travi si vedono solo dall\'alto. Per questo sei gabbiano: vola verso la luce verde e cerca il libro sotto le travi.' },
  { label: '08:15', place: 'Un libro aperto, al chiosco', form: 'sand',
    text: 'Rileggo la stessa pagina da tre giorni. Non dimentico il libro: dimentico il punto in cui avevo smesso.',
    thought: 'Nel libro, un segnalibro a matita: «fino in fondo, a piedi nudi». Il vento soffia verso il pontile.',
    goal: 'In fondo al pontile: il vento ti porta, il mare ti prende.', become: 'Diventi sabbia. Quando tocchi l\'acqua, diventi acqua.',
    why: 'Il segnalibro dice «fino in fondo». Il vento conosce la strada e la sabbia lo segue: quando tocchi l\'acqua diventi acqua. Cerca i sandali in fondo al pontile.' },
  { label: '10:30', place: 'Un paio di sandali, in fondo al pontile', form: 'fish',
    text: 'Li lascio allineati, la punta verso il mare. Se un giorno non saprò da che parte andare, mi basterà guardare le scarpe.',
    thought: 'Le punte guardano il mare. Laggiù, sul fondo, qualcosa luccica quando il sole è alto.',
    goal: 'Qualcosa luccica sul fondo, davanti al pontile.', become: 'Scivoli in acqua e diventi un pesce. Il fondo è vicino.',
    why: 'Le punte dei sandali guardano il fondo, dove nessuno arriva senza fiato. Per questo sei pesce: cerca il luccichio dell\'orologio.' },
  { label: '12:00', place: 'Un orologio, sul fondo', form: 'wave',
    text: 'L\'ho lasciato cadere apposta. Si è fermato a mezzogiorno, quando il sole entra dritto nell\'acqua e il fondo si vede tutto. Qui sotto è sempre quell\'ora.',
    thought: 'A mezzogiorno qualcuno saliva sempre sulla torretta del bagnino. Un\'onda ti porterà fin là.',
    goal: 'La torretta del bagnino, a est.', become: 'Diventi un\'onda. Corri verso riva, piega verso la torretta.',
    why: 'L\'orologio è fermo a mezzogiorno, l\'ora del bagnino. Un\'onda va sempre verso riva: lasciati portare fino alla torretta e cerca il cappello.' },
  { label: '15:20', place: 'Un cappello di paglia, alla torretta', form: 'cloud',
    text: 'D\'estate c\'erano voci, radio, qualcuno che chiamava un nome dall\'acqua. Adesso restano i gabbiani. Mi sembrano gli stessi di allora.',
    thought: 'Dentro il cappello, un nome scritto a mano. Lo stesso nome dipinto su una barca tirata in secco, lontano, a ovest.',
    goal: 'Una barca in secco, a ovest: arrivaci come nuvola, scendi come pioggia (Q).', become: 'Il sole ti solleva: diventi nuvola. Sopra la barca, scendi come pioggia (Q).',
    why: 'Il nome nel cappello è dipinto su una barca lontana, a ovest. Una nuvola va lontano senza fatica: quando sei sopra la barca, piovi (Q) e cerca la lettera.' },
  { label: '17:45', place: 'Una lettera, nella barca', form: 'cat',
    text: 'Ti ho scritto molte lettere che non ho spedito. Questa è l\'unica in cui non ti chiedo di tornare.',
    thought: 'La lettera finisce così: «ho lasciato la lanterna accesa dove finiscono gli scogli». Un gatto conosce la strada tra i sassi.',
    goal: 'Dove finiscono gli scogli.', become: 'Diventi un gatto. Leggero tra i sassi, curioso.',
    why: 'Gli scogli sono stretti e scivolosi; un gatto ci passa leggero. Arriva fino alla punta e cerca la lanterna.' },
  { label: '19:30', place: 'Una lanterna, sugli scogli', form: 'body',
    text: 'Quando il buio arriva presto accendo la lanterna. Non per farmi vedere: per riconoscere la riva da lontano, dall\'acqua.',
    thought: 'Dalla punta degli scogli si vede una vela, al largo. Qualcuno ci ha lasciato qualcosa a bordo.',
    goal: 'La barca a vela, al largo.', become: 'Torni umano. Per il largo servono le mani: un barchino, un SUP.',
    needs: 'sea', needsHint: 'A nuoto è lontana. In fondo al pontile c\'è un barchino, allo stabilimento un SUP.',
    why: 'Il largo si raggiunge con le mani: il barchino in fondo al pontile, o il SUP allo stabilimento. Raggiungi la barca a vela e cerca la bottiglia.' },
  { label: '21:00', place: 'Una bottiglia, a bordo della barca a vela', form: 'gull',
    text: 'Dentro c\'è un elenco: candela, libro, sandali, orologio, cappello, lettera, lanterna. Chi lo trova saprà che non erano cose perse. Erano un sentiero.',
    thought: 'Sul retro dell\'elenco, un disegno: un cipresso, un muretto, un binocolo. Lassù, sulle colline.',
    goal: 'Il cipresso sulle colline, dove c\'è il muretto.', become: 'Diventi di nuovo gabbiano. Le colline sono lontane, ma l\'aria è larga.',
    why: 'Il disegno indica il cipresso sulle colline, lontano. In volo ci arrivi presto: cerca il binocolo sul muretto.' },
  { label: '22:30', place: 'Un binocolo, al belvedere', form: 'glide',
    text: 'Da quassù la riva è una linea sola, e tutti i giorni sembrano lo stesso giorno. Forse è così che si ricorda: da lontano.',
    thought: 'Nel binocolo, laggiù vicino alla bandiera rossa, c\'è qualcuno che guarda il mare.',
    goal: 'Torna alla bandiera rossa.', become: 'Sul crinale c\'è un deltaplano. Lanciati verso la bandiera.',
    why: 'Nel binocolo c\'era qualcuno vicino alla bandiera rossa. Il deltaplano scende piano: atterra vicino alla bandiera.' },
];

export const FINALE = [
  'Ti sciogli piano, come la luce della sera sull\'acqua.',
  'Diventi tutto quello che hai attraversato: aria, sabbia, acqua, onda, nuvola, pioggia.',
];

export const ENDING = [
  'Non ti aspettavo. O forse sì, ma non sapevo il tuo nome.',
  'Ho lasciato quelle cose per ritrovare la strada, nei giorni in cui la dimentico.',
  'Adesso la conosci anche tu.',
  'Ricordala, quando io non potrò.',
];

export class Journal {
  constructor() {
    this.el = document.getElementById('journal');
    this.list = document.getElementById('journalList');
    this.found = new Set();
    this.open = false;
    this.render();
  }
  add(i) { this.found.add(i); this.render(); }
  addDiscovery(d) { (this.disc ||= []).push(d); this.render(); }
  toggle(force) {
    this.open = force ?? !this.open;
    this.el.classList.toggle('open', this.open);
  }
  render() {
    this.list.innerHTML = FRAGMENTS.map((f, i) => this.found.has(i)
      ? `<li><span class="pl">${f.label} · ${f.place}</span><span class="tx">${f.text}</span><span class="th">${f.thought}</span></li>`
      : `<li class="miss"><span class="pl">· · ·</span></li>`).join('')
      + (this.disc && this.disc.length ? '<li class="sep"><span class="pl">Scoperte</span></li>' + this.disc.map((d) => `<li><span class="pl">${d.title}</span><span class="tx">${d.text}</span><span class="th">${d.thought}</span></li>`).join('') : '');
  }
}

// Scoperte: si trovano vagando, senza ordine obbligato. Alcune portano ad altre.
export const DISCOVERIES = {
  isola: { title: 'L\'isola che beve',
    text: 'Hai piovuto su un\'isola secca. La terra ha bevuto, e in un pomeriggio è nato tutto: macchia, fiori, pini storti dal vento.',
    thought: 'Un petalo si stacca, e tu con lui. Il vento ti porta verso una vela ferma, al largo.' },
  vento: { title: 'Il vento nelle vele',
    text: 'La barca a vela era ferma da giorni, senza un filo d\'aria. Sei passato tu, e le vele si sono gonfiate.',
    thought: 'Ora va verso casa. Tu puoi restare vento, o tornare corpo (B).' },
  registro: { title: 'Il registro del molo',
    text: 'Registro di carico, fine anni ottanta. Tonnellate, nomi di navi, orari. L\'ultima riga è scritta da un\'altra mano: «Domani smontano la gru. La radio della piattaforma la lascio accesa.»',
    thought: 'Una radio lasciata accesa, là in mezzo al mare. Chissà se parla ancora.', next: 'radio' },
  radio: { title: 'La radio sulla piattaforma',
    text: 'Il quadrante verde è ancora acceso. Tra i fruscii, una voce ripete sempre la stessa cosa: delle coordinate, e il nome di una barca da pesca.',
    thought: 'Quella barca è affondata davanti al vecchio molo. È ancora là sotto.', next: 'relitto' },
  relitto: { title: 'Il relitto',
    text: 'Sul fondo, una barca da pesca coricata su un fianco. Il nome sulla prua è lo stesso scritto dentro il cappello di paglia.',
    thought: 'Resti fermo tra le correnti, e per un momento non senti più dove finisci tu e dove comincia l\'acqua.',
    unlock: 'flow' },
  delfini: { title: 'I delfini',
    text: 'Escono dall\'acqua tutti insieme, uno dopo l\'altro, e rientrano senza rumore.',
    thought: 'Come un pensiero che torna, quando hai smesso di cercarlo.' },
  tartaruga: { title: 'La tartaruga',
    text: 'Una tartaruga marina nuota piano accanto a te, senza fretta.',
    thought: 'Torna ogni anno sulla stessa spiaggia. Nessuno le ha mai spiegato la strada.' },
  gru: { title: 'In cima alla gru',
    text: 'Da quassù il molo è una frase interrotta: mancano dei pezzi, eppure si capisce lo stesso.',
    thought: 'Forse anche i ricordi funzionano così.' },
  stella: { title: 'Una stella cadente',
    text: 'Una stella cadente, lunga, sopra il mare.',
    thought: 'Non hai fatto in tempo a esprimere un desiderio. Forse non serviva.' },
};

// Eco: ricordi che riaffiorano la prima volta che entri in un luogo. Piccoli, a margine.
export const ECHOES = {
  pontile: 'Qui si facevano le gare a chi arrivava prima in fondo. Vinceva sempre chi non correva.',
  foce: 'Qui l\'acqua dolce incontra quella salata, senza fretta. Ci si veniva a togliere la sabbia dai piedi.',
  chiosco: 'Un\'estate intera di granite al limone, e la sera il rumore delle serrande che si abbassano.',
  stabilimento: 'Le cabine hanno ancora i numeri dipinti. La sette era la nostra.',
  scogliera: 'Tra gli scogli si cercavano i granchi con le mani. Nessuno ne ha mai preso uno davvero.',
  barca: 'Ogni settembre la tiravano un po\' più in alto, come se il mare potesse dimenticarsene.',
  lungomare: 'La sera si camminava fin qui, e poi si tornava indietro. Non si andava mai oltre.',
  colline: 'Da bambini sembravano montagne. Adesso sono colline, ma il vento è lo stesso.',
  molo: 'Il molo è servito alle navi, poi alle canne da pesca, poi a nessuno.',
  capannone: 'Dentro c\'è ancora odore di ferro e di sale.',
  piattaforma: 'Di notte la luce rossa in cima si vedeva dalla finestra. Era il modo di sapere dov\'era il largo.',
  bandiera: 'La bandiera rossa c\'era sempre, anche col mare calmo. Nessuno si ricorda perché.',
  largo: 'Da qui la riva è una linea sottile. Tutto quello che conosci sta lì dentro.',
};
