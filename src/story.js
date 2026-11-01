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
  { label: '06:40', place: 'Un barattolo con una candela', act: 'pick', form: 'gull',
    text: 'Accendo la candela prima che faccia giorno. Non serve a vedere: serve a sapere che anche oggi ho trovato la strada.',
    thought: 'La fiamma si piega verso est, verso la vecchia gru in fondo al molo. Lassù qualcuno guardava il mare, ogni mattina.',
    goal: 'In cima alla gru del vecchio molo.', become: 'Diventi un gabbiano. L\'aria ti tiene.',
    why: 'La gru è alta e lontana: solo le ali ci arrivano. Vola fin lassù e posati, piano, sulla cima.',
    prompt: 'Scendi piano e posati sulla cima della gru' },
  { label: '08:15', place: 'Un cappello di paglia, in cima alla gru', act: 'land', form: 'fish',
    text: 'D\'estate c\'erano voci, radio, qualcuno che chiamava un nome dall\'acqua. Da quassù li vedevo tutti, piccoli. Il cappello l\'ha portato il vento, e l\'ho lasciato qui.',
    thought: 'Da quassù, sotto il pelo dell\'acqua, si vede la sagoma di una barca affondata.',
    goal: 'Il relitto sul fondo, davanti al molo.', become: 'Ti lasci cadere. Entri nel mare e diventi un pesce.',
    why: 'Il relitto è sul fondo, dove nessuno arriva senza fiato. Nuota fino a lui, scendi vicino alla sabbia e smuovila (Spazio o C).',
    prompt: 'Vicino al fondo: smuovi la sabbia (Spazio o C)' },
  { label: '10:30', place: 'Un orologio, nel relitto', act: 'stir', form: 'wave',
    text: 'Si è fermato a mezzogiorno, quando il sole entra dritto nell\'acqua e il fondo si vede tutto. Qui sotto è sempre quell\'ora.',
    thought: 'Il quadrante guarda la riva, verso la torretta del bagnino. Il mare sa come portare a terra le cose.',
    goal: 'La riva della torretta del bagnino.', become: 'Risali, e il mare ti solleva: diventi un\'onda.',
    why: 'Un\'onda porta a riva quello che il mare custodisce. Corri verso la torretta e rompiti sulla sabbia lì davanti.',
    prompt: 'Rompiti sulla riva, davanti alla torretta' },
  { label: '12:00', place: 'Una bottiglia, portata a riva dall\'onda', act: 'break', form: 'body',
    text: 'Dentro c\'è un biglietto: «Ti aspetto dove finisce il pontile, a piedi nudi.» La calligrafia è la mia, di tanti anni fa.',
    thought: 'Il pontile è lontano, a ovest. Certe strade vanno fatte a piedi.',
    goal: 'In fondo al pontile, a piedi.', become: 'L\'onda si ritira. Torni umano, i piedi nella sabbia bagnata.',
    why: 'Il pontile si percorre solo camminando: le tavole sotto i piedi, il mare ai lati. Arriva fino in fondo.' },
  { label: '15:20', place: 'Un paio di sandali, in fondo al pontile', act: 'pick', form: 'cat',
    text: 'Li lascio allineati, la punta verso il mare. Se un giorno non saprò da che parte andare, mi basterà guardare le scarpe.',
    thought: 'Accanto ai sandali, piccole impronte di zampe tornano verso il chiosco.',
    goal: 'Il chiosco sotto la pergola.', become: 'Ti fai piccolo e leggero: diventi un gatto.',
    why: 'Sotto il chiosco c\'è un posto dove entra solo un gatto. Arriva al tavolo e saltaci sopra (Spazio).',
    prompt: 'Salta sul tavolo (Spazio)' },
  { label: '17:00', place: 'Un libro aperto, al chiosco', act: 'pounce', form: 'sand',
    text: 'Rileggo la stessa pagina da tre giorni. Non dimentico il libro: dimentico il punto in cui avevo smesso.',
    thought: 'Nel libro, un segnalibro: il disegno di una barca in secco, a ovest, mezza sepolta dalla sabbia.',
    goal: 'La barca in secco, a ovest.', become: 'Il vento ti prende: diventi sabbia.',
    why: 'La sabbia va dove va il vento, e copre e scopre le cose. Arriva alla barca e ammucchiati contro di lei (Spazio).',
    prompt: 'Ammucchiati contro la barca (Spazio)' },
  { label: '18:30', place: 'Una lettera, nella barca', act: 'cover', form: 'cloud',
    text: 'Ti ho scritto molte lettere che non ho spedito. Questa è l\'unica in cui non ti chiedo di tornare.',
    thought: 'La lettera finisce con un disegno: un cipresso e un muretto, lassù sulle colline.',
    goal: 'Il belvedere sulle colline: piovi sul cipresso.', become: 'Il sole ti scalda e ti solleva: diventi nuvola.',
    why: 'Le colline sono lontane e alte. Da nuvola ci arrivi: quando sei sopra il cipresso, piovi (Q).',
    prompt: 'Sei sopra il belvedere: piovi (Q)' },
  { label: '20:00', place: 'Un binocolo, al belvedere', act: 'rain', form: 'glide',
    text: 'Da quassù la riva è una linea sola, e tutti i giorni sembrano lo stesso giorno. Forse è così che si ricorda: da lontano.',
    thought: 'Nel binocolo, in fondo agli scogli, una lanterna accesa.',
    goal: 'La punta degli scogli.', become: 'Sul crinale c\'è un deltaplano. Ti lanci.',
    why: 'Gli scogli sono lontani, giù verso il mare. Plana fin là, atterra e cammina fino alla lanterna.' },
  { label: '21:30', place: 'Una lanterna, sugli scogli', act: 'pick',
    text: 'Quando il buio arriva presto accendo la lanterna. Non per farmi vedere: per riconoscere la riva da lontano, dall\'acqua.',
    thought: 'Dalla punta degli scogli, sulla riva, vicino alla bandiera rossa, c\'è qualcuno che guarda il mare.',
    goal: 'Torna alla bandiera rossa.' },
];

export const FINALE = [
  'Ti sciogli piano, come la luce della sera sull\'acqua.',
  'Diventi tutto quello che hai attraversato: aria, mare, onda, sabbia, nuvola, pioggia.',
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
