// La storia: qualcuno veniva su questa riva ogni giorno, alla stessa ora.
// Ha lasciato sette oggetti. Ognuno custodisce un frammento di ciò che ha scritto.

export const INTRO = [
  'Qualcuno ha lasciato delle cose lungo la riva.',
  'Le impronte sono ancora fresche.',
];

export const FRAGMENTS = [
  { place: 'Un barattolo con una candela', text: 'Venivo qui ogni giorno, alla stessa ora. Il mare non cambiava mai: ero io a cambiare.' },
  { place: 'Un libro aperto, al chiosco', text: 'Leggevo sempre la stessa pagina, aspettando che il sole arrivasse alle travi.' },
  { place: 'Un paio di sandali, in fondo al pontile', text: 'In fondo al pontile mi toglievo i sandali. Da lì l\'acqua sembrava più vicina del cielo.' },
  { place: 'Un cappello di paglia, alla torretta', text: 'D\'estate qui c\'erano voci, ombrelloni, radio. Io preferivo quando restava solo il vento.' },
  { place: 'Una lettera, nella barca', text: 'Non l\'ho mai spedita. Era più facile lasciarla al mare.' },
  { place: 'Una lanterna, sugli scogli', text: 'La accendevo quando faceva buio presto, così avresti saputo da che parte tornare.' },
  { place: 'Una bottiglia, al largo', text: 'Se hai trovato anche questa, allora non ho aspettato invano. Torna dove c\'è la bandiera.' },
];

export const ENDING = [
  'Eccoti.',
  'Le impronte erano mie. Le cose che hai trovato, anche.',
  'Non serve cercarmi ancora. Basta tornare qui, a quest\'ora.',
  'Resta quanto vuoi.',
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
      ? `<li><span class="pl">${f.place}</span><span class="tx">${f.text}</span></li>`
      : '<li class="miss"><span class="pl">· · ·</span></li>').join('');
  }
}
