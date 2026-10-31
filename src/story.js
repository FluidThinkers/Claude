// La storia: qualcuno veniva su questa riva ogni giorno, alla stessa ora.
// Ha lasciato sette luci. Ogni luce custodisce un frammento di ciò che ha scritto.

export const INTRO = [
  'Qualcuno ha lasciato delle luci lungo la riva.',
  'La bandiera sa dove sono.',
];

export const FRAGMENTS = [
  { place: 'La cresta', text: 'Venivo qui ogni giorno, alla stessa ora. Il mare non cambiava mai: ero io a cambiare.' },
  { place: 'La passerella', text: 'Ho lasciato la mia luce sulla riva, così avresti saputo dove cercarmi.' },
  { place: 'La Soglia', text: 'Attraversavo quella cornice per allungare il tramonto. Funzionava, quasi sempre.' },
  { place: 'La Scala', text: 'C\'è una scala che non porta da nessuna parte. Ci salivo per vedere più lontano il tempo.' },
  { place: 'Le Colonne', text: 'Le colonne erano una casa, una volta. Ora tengono in piedi soltanto il cielo.' },
  { place: 'La piattaforma', text: 'Il ferro sul mare respira di notte. Gli ho chiesto di te, non ha risposto.' },
  { place: 'Lo Specchio', text: 'Se hai trovato anche questa, allora non ho aspettato invano. Voltati.' },
];

export const ENDING = [
  'Eccoti.',
  'Le impronte erano mie. Le luci erano per te.',
  'Il giorno qui non finisce: ricomincia.',
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
