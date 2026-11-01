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
    goal: 'Posati in cima alla gru del vecchio molo.', become: 'Diventi un gabbiano. L\'aria ti tiene.',
    why: 'La gru è alta e lontana: solo le ali ci arrivano. Vola fin lassù e posati, piano, sulla cima.',
    prompt: 'Scendi piano: posati sulla cima' },
  { label: '08:15', place: 'Un cappello di paglia, in cima alla gru', act: 'land', form: 'fish',
    text: 'D\'estate c\'erano voci, radio, qualcuno che chiamava un nome dall\'acqua. Da quassù li vedevo tutti, piccoli. Il cappello l\'ha portato il vento, e l\'ho lasciato qui.',
    thought: 'Da quassù, sotto il pelo dell\'acqua, si vede una barca affondata. Attorno, un banco di pesci d\'argento.',
    goal: 'Il relitto: trova il banco di pesci e nuota con loro.', become: 'Ti lasci cadere. Entri nel mare e diventi un pesce.',
    why: 'Un pesce da solo non trova niente. Raggiungi il banco vicino al relitto e nuota con loro: ti mostreranno cosa c\'è sul fondo.',
    prompt: 'Resta con il banco, nuota con loro' },
  { label: '10:30', place: 'Un orologio, nel relitto', act: 'friends', form: 'wave',
    text: 'Si è fermato a mezzogiorno, quando il sole entra dritto nell\'acqua e il fondo si vede tutto. Qui sotto è sempre quell\'ora.',
    thought: 'Il quadrante guarda la riva, verso la torretta del bagnino. Il mare sa come portare a terra le cose, se l\'onda è abbastanza grande.',
    goal: 'Diventa un\'onda grande e rompiti sulla riva della torretta.', become: 'Risali, e il mare ti solleva: diventi un\'onda.',
    why: 'Solo un\'onda grande porta a riva quello che il mare custodisce. Cresci (avanti), unisciti alle onde che arrivano, e rompiti davanti alla torretta.',
    prompt: 'Cresci ancora (avanti): solo un\'onda grande arriva fin qui' },
  { label: '12:00', place: 'Una bottiglia, portata a riva dall\'onda', act: 'bigwave', form: 'wind',
    text: 'Dentro c\'è un biglietto: «Al largo, dove il vecchio nastro portava il carbone, c\'è una cassetta. La chiave è dentro.»',
    thought: 'Laggiù, lontano sul mare, una rovina di ferro. Sopra, le nuvole la tengono al buio.',
    goal: 'La rovina al largo: spazza via le nuvole (C).', become: 'Il biglietto vola via dalle dita. Lo segui: diventi vento.',
    why: 'Il vento arriva ovunque, veloce. Vola alla rovina e spazza via le nuvole (C): quando la luce scende, il tuo soffio spalancherà la cabina e la cassetta.',
    prompt: 'Spazza via le nuvole (C)' },
  { label: '14:00', place: 'Una lettera e una chiave, nella rovina', act: 'clear', form: 'cloud',
    text: 'Il tuo soffio spalanca la porta della cabina e solleva il coperchio arrugginito. Dentro: «Ti ho scritto molte lettere che non ho spedito. Questa è l\'unica in cui non ti chiedo di tornare.» E una chiave, che il vento porta con sé.',
    thought: 'La lettera finisce con un disegno: un cipresso, sulle colline. Sotto, a matita: «ha sete».',
    goal: 'Il cipresso del belvedere: piovi su di lui (Q).', become: 'Il sole scalda il ferro e l\'acqua: ti sollevi, diventi nuvola.',
    why: 'Il cipresso lassù è secco da tutta l\'estate. Da nuvola ci arrivi: quando sei sopra di lui, piovi (Q). Dalla pioggia nascerà un ricordo.',
    prompt: 'Sei sopra il cipresso: piovi (Q)' },
  { label: '16:00', place: 'Un binocolo, nato sotto la pioggia al belvedere', act: 'rain', form: 'cat',
    text: 'Da quassù la riva è una linea sola, e tutti i giorni sembrano lo stesso giorno. Forse è così che si ricorda: da lontano.',
    thought: 'Nel binocolo, giù sulla spiaggia, la barca in secco al sole. Sul bordo, un gatto dormiva sempre lì.',
    goal: 'La barca in secco: trova il posto al sole e appisolati.', become: 'Scendi a terra leggero, sulle quattro zampe: diventi un gatto.',
    why: 'Un gatto sa trovare il posto più caldo. Scendi fino alla barca in secco, trova il sole e appisolati (resta fermo): sognerai qualcosa.',
    prompt: 'Resta fermo al sole: appisolati' },
  { label: '17:30', place: 'Un libro, sognato al sole sulla barca', act: 'nap', form: 'ant',
    text: 'Rileggo la stessa pagina da tre giorni. Non dimentico il libro: dimentico il punto in cui avevo smesso.',
    thought: 'Svegliandoti vedi una fila di formiche che porta briciole verso il pontile. Una briciola è rimasta indietro.',
    goal: 'Porta la briciola al formicaio, all\'inizio del pontile.', become: 'Ti fai piccolissimo: diventi una formica.',
    why: 'Le formiche portano tutto a casa. Prendi la briciola qui vicino e portala al formicaio, all\'inizio del pontile.',
    prompt: 'Prendi la briciola' },
  { label: '19:00', place: 'Un paio di sandali, accanto al formicaio', act: 'carry', form: 'body',
    text: 'Li lascio allineati, la punta verso il mare. Se un giorno non saprò da che parte andare, mi basterà guardare le scarpe.',
    thought: 'Le punte guardano gli scogli, a ovest. In fondo, una lanterna spenta, chiusa a chiave.',
    goal: 'La punta degli scogli: apri la lanterna con la chiave.', become: 'Torni grande, torni umano. I sandali ai piedi.',
    why: 'Gli scogli si fanno a piedi, piano. In fondo c\'è la lanterna: hai la chiave della rovina.' },
  { label: '21:00', place: 'Una lanterna, sugli scogli', act: 'pick', key: true,
    text: 'Quando il buio arriva presto accendo la lanterna. Non per farmi vedere: per riconoscere la riva da lontano, dall\'acqua.',
    thought: 'Dalla punta degli scogli, sulla riva, vicino alla bandiera rossa, c\'è qualcuno che guarda il mare.',
    goal: 'Torna alla bandiera rossa.' },
];

export const FINALE = [
  'Ti sciogli piano, come la luce della sera sull\'acqua.',
  'Diventi tutto quello che hai attraversato: aria, mare, onda, vento, nuvola, pioggia, terra.',
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
  rovina: { title: 'La rovina al largo',
    text: 'Un vecchio pontile di carico, lasciato in mezzo al mare: due silos arrugginiti, un nastro che non porta più niente a riva, una cabina con la porta aperta.',
    thought: 'Qualcuno, qui, contava le navi. Adesso le conta il vento.' },
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
