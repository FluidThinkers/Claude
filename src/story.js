// La storia: l'ultimo giorno della stagione, scandito dalle ore.
// Qualcuno ha lasciato degli oggetti lungo la riva, uno per ogni ora, come segnavia.
// Non per chi li trova: per sé, per i giorni in cui la strada si dimentica.
// Ogni oggetto riflette la luce soltanto alla sua ora.

export const INTRO = [
  'Fine settembre.',
  'Gli ultimi giorni, prima che chiudano tutto.',
];

// hour: frazione del giorno in cui l'oggetto si lascia vedere (null = sempre)
export const FRAGMENTS = [
  { hour: 0.278, label: '06:40', place: 'Un barattolo con una candela, sul cumulo',
    text: 'Accendo la candela prima che faccia giorno. Non serve a vedere: serve a sapere che anche oggi ho trovato la strada.' },
  { hour: 0.344, label: '08:15', place: 'Un libro aperto, al chiosco',
    text: 'Rileggo la stessa pagina da tre giorni. Non dimentico il libro: dimentico il punto in cui avevo smesso.' },
  { hour: 0.4375, label: '10:30', place: 'Un paio di sandali, in fondo al pontile',
    text: 'Li lascio allineati, la punta verso il mare. Se un giorno non saprò da che parte andare, mi basterà guardare le scarpe.' },
  { hour: 0.5, label: '12:00', place: 'Un orologio, sul fondo',
    text: 'L\'ho lasciato cadere apposta. Si è fermato a mezzogiorno, quando il sole entra dritto nell\'acqua e il fondo si vede tutto. Qui sotto è sempre quell\'ora.' },
  { hour: 0.639, label: '15:20', place: 'Un cappello di paglia, alla torretta',
    text: 'D\'estate c\'erano voci, radio, qualcuno che chiamava un nome dall\'acqua. Adesso restano i gabbiani. Mi sembrano gli stessi di allora.' },
  { hour: 0.74, label: '17:45', place: 'Una lettera, nella barca',
    text: 'Ti ho scritto molte lettere che non ho spedito. Questa è l\'unica in cui non ti chiedo di tornare.' },
  { hour: 0.8125, label: '19:30', place: 'Una lanterna, sugli scogli',
    text: 'Quando il buio arriva presto accendo la lanterna. Non per farmi vedere: per riconoscere la riva da lontano, dall\'acqua.' },
  { hour: null, label: '—', place: 'Una bottiglia, al largo',
    text: 'Dentro c\'è solo un elenco: candela, libro, sandali, orologio, cappello, lettera, lanterna. Chi lo trova saprà che non erano cose perse. Erano un sentiero.' },
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
  toggle(force) {
    this.open = force ?? !this.open;
    this.el.classList.toggle('open', this.open);
  }
  render() {
    this.list.innerHTML = FRAGMENTS.map((f, i) => this.found.has(i)
      ? `<li><span class="pl">${f.label} · ${f.place}</span><span class="tx">${f.text}</span></li>`
      : `<li class="miss"><span class="pl">${f.label} · · ·</span></li>`).join('');
  }
}
