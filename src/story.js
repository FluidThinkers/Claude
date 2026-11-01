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
  { label: '06:40', place: 'Un barattolo con una candela',
    text: 'Accendo la candela prima che faccia giorno. Non serve a vedere: serve a sapere che anche oggi ho trovato la strada.',
    thought: 'La luce della candela finiva sempre sulle pagine di un libro, all\'ombra delle travi.',
    goal: 'Dove si leggeva all\'ombra delle travi?' },
  { label: '08:15', place: 'Un libro aperto, al chiosco',
    text: 'Rileggo la stessa pagina da tre giorni. Non dimentico il libro: dimentico il punto in cui avevo smesso.',
    thought: 'Tra le pagine, un segnalibro scritto a matita: «fino in fondo, a piedi nudi».',
    goal: 'Fino in fondo, a piedi nudi.' },
  { label: '10:30', place: 'Un paio di sandali, in fondo al pontile',
    text: 'Li lascio allineati, la punta verso il mare. Se un giorno non saprò da che parte andare, mi basterà guardare le scarpe.',
    thought: 'Le punte guardano il mare. Laggiù, sul fondo, qualcosa luccica quando il sole è alto.',
    goal: 'Qualcosa luccica sul fondo, davanti al pontile.',
    needs: 'gear', needsHint: 'Senza maschera non si vede niente là sotto. Allo stabilimento ne lasciano sempre una ad asciugare.' },
  { label: '12:00', place: 'Un orologio, sul fondo',
    text: 'L\'ho lasciato cadere apposta. Si è fermato a mezzogiorno, quando il sole entra dritto nell\'acqua e il fondo si vede tutto. Qui sotto è sempre quell\'ora.',
    thought: 'A mezzogiorno qualcuno saliva sempre sulla torretta del bagnino, col cappello calato sugli occhi.',
    goal: 'Chi saliva sulla torretta a mezzogiorno?' },
  { label: '15:20', place: 'Un cappello di paglia, alla torretta',
    text: 'D\'estate c\'erano voci, radio, qualcuno che chiamava un nome dall\'acqua. Adesso restano i gabbiani. Mi sembrano gli stessi di allora.',
    thought: 'Dentro il cappello, un nome scritto a mano. Lo stesso nome dipinto su una barca tirata in secco.',
    goal: 'Una barca in secco, con un nome sulla fiancata.' },
  { label: '17:45', place: 'Una lettera, nella barca',
    text: 'Ti ho scritto molte lettere che non ho spedito. Questa è l\'unica in cui non ti chiedo di tornare.',
    thought: 'La lettera finisce così: «ho lasciato la lanterna accesa dove finiscono gli scogli».',
    goal: 'Dove finiscono gli scogli.' },
  { label: '19:30', place: 'Una lanterna, sugli scogli',
    text: 'Quando il buio arriva presto accendo la lanterna. Non per farmi vedere: per riconoscere la riva da lontano, dall\'acqua.',
    thought: 'Dalla punta degli scogli si vede una vela, al largo. Qualcuno ci ha lasciato qualcosa a bordo.',
    goal: 'La barca a vela, al largo.',
    needs: 'sea', needsHint: 'A nuoto è lontana. In fondo al pontile c\'è un barchino, allo stabilimento un SUP.' },
  { label: '21:00', place: 'Una bottiglia, a bordo della barca a vela',
    text: 'Dentro c\'è un elenco: candela, libro, sandali, orologio, cappello, lettera, lanterna. Chi lo trova saprà che non erano cose perse. Erano un sentiero.',
    thought: 'Sul retro dell\'elenco, un disegno: un cipresso, un muretto, un binocolo. Lassù, sulle colline.',
    goal: 'Un cipresso e un muretto, sulle colline.',
    needs: 'land', needsHint: 'Sul lungomare c\'è una moto. Le colline sono più vicine di quanto sembrano.' },
  { label: '22:30', place: 'Un binocolo, al belvedere',
    text: 'Da quassù la riva è una linea sola, e tutti i giorni sembrano lo stesso giorno. Forse è così che si ricorda: da lontano.',
    thought: 'Nel binocolo, laggiù vicino alla bandiera rossa, c\'è qualcuno che guarda il mare.',
    goal: 'Torna alla bandiera rossa.',
    needsHint: 'Per scendere c\'è un deltaplano sul crinale, poco più in alto.' },
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
