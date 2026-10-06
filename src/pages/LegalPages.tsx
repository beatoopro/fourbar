import type { ReactNode } from 'react';

/**
 * Pages légales et crédits (#/terms, #/privacy, #/credits).
 * À COMPLÉTER avant la mise en ligne : les champs de SITE marqués « TODO »
 * (éditeur du site, contact, hébergeur), obligatoires en France (LCEN) et pour le RGPD.
 * Ces textes sont une base de travail, pas un avis juridique.
 */
export const SITE = {
  name: 'Fourbar',
  publisher: 'TODO: your full name (or company name and registration number)',
  address: 'TODO: postal address',
  contact: 'TODO: contact email',
  host: 'TODO: hosting provider name, address and phone',
  updated: 'October 6, 2026',
};

function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page legal">
      <a className="legal-back" href="#/explore">
        ← Back to Explore
      </a>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: {SITE.updated}</p>
      {children}
    </div>
  );
}

export function TermsPage() {
  return (
    <Legal title="Terms of Use">
      <h2>1. About {SITE.name}</h2>
      <p>
        {SITE.name} is a free platform to compose, share, listen to and remix 4-bar loops. It is published by {SITE.publisher},{' '}
        {SITE.address} (contact: {SITE.contact}). The site is hosted by {SITE.host}.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You can browse, listen, compose and remix without an account. A free account is needed to publish, like, comment, report
        and keep downloading. You must be 15 or older to create an account. You are responsible for what is posted from your
        account, and you must give a valid email address.
      </p>

      <h2>3. Your loops</h2>
      <p>
        You keep the rights to the loops you create. By publishing a loop on {SITE.name}, you allow anyone to listen to it,
        download it (MIDI or WAV) and remix it, and use the result in their own music, including commercially, free of charge. A
        remix always shows a link to the original loop. Only publish loops you made yourself or have the right to share.
      </p>
      <p>You can delete your loops at any time. Copies already downloaded or remixed by others are not affected.</p>

      <h2>4. Comments and behavior</h2>
      <p>
        Be respectful. Harassment, hate speech, spam, illegal content and content that infringes someone else’s rights are not
        allowed. We may remove content or suspend an account that breaks these rules. Anyone can report a comment; we review
        reports as quickly as we can.
      </p>

      <h2>5. Sounds</h2>
      <p>
        The instrument samples built into {SITE.name} come from free libraries listed on the <a href="#/credits">Credits</a>{' '}
        page. The audio you export can be used freely in your music.
      </p>

      <h2>6. Service</h2>
      <p>
        {SITE.name} is provided as is, free of charge. We do our best to keep it available and your data safe, but we cannot
        guarantee it will never be interrupted. Keep your own copies of the loops that matter to you (MIDI or WAV export).
      </p>

      <h2>7. Changes and contact</h2>
      <p>
        We may update these terms; the date at the top shows the latest version. These terms are governed by French law. Questions:{' '}
        {SITE.contact}.
      </p>
    </Legal>
  );
}

export function PrivacyPage() {
  return (
    <Legal title="Privacy Policy">
      <h2>Who is responsible</h2>
      <p>
        {SITE.publisher}, {SITE.address}, is responsible for the personal data processed on {SITE.name}. Contact: {SITE.contact}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account: your email address, the name and @username you choose, and, if you sign in with Google, your Google account ID.</li>
        <li>What you post: your loops, comments, likes and reports.</li>
        <li>On your device: your drafts and preferences, kept in your browser’s local storage.</li>
      </ul>
      <p>We don’t use advertising or tracking cookies, and we don’t sell your data.</p>

      <h2>Why</h2>
      <p>
        To run your account and show your loops and comments to the community (our agreement with you), and to keep the platform
        safe, for example by handling reports (our legitimate interest).
      </p>

      <h2>Who sees it</h2>
      <p>
        Your name, @username, published loops and comments are public. Your email address is never shown. Data is stored by our
        hosting provider ({SITE.host}) and is not shared with anyone else, unless required by law.
      </p>

      <h2>How long</h2>
      <p>As long as your account exists. When you delete your account, your personal data is deleted within 30 days.</p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data, and object to its use, by writing to {SITE.contact}. You can also
        file a complaint with the CNIL (cnil.fr).
      </p>
    </Legal>
  );
}

const SAMPLES = [
  {
    instrument: 'Grand Piano',
    source: 'Salamander Grand Piano V3',
    author: 'Alexander Holm',
    via: { label: 'Tonejs/audio', url: 'https://github.com/Tonejs/audio' },
    license: { label: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
  },
  {
    instrument: 'Electric Piano, Finger Bass, Upright Bass',
    source: 'FluidR3_GM',
    author: 'Frank Wen',
    via: { label: 'gleitz/midi-js-soundfonts', url: 'https://github.com/gleitz/midi-js-soundfonts' },
    license: { label: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/us/' },
  },
  {
    instrument: 'Ride cymbal',
    source: 'Versilian Community Sample Library (Suspended Cymbal 1)',
    author: 'Versilian Studios',
    via: { label: 'sgossner/VCSL', url: 'https://github.com/sgossner/VCSL' },
    license: { label: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  },
];

export function CreditsPage() {
  return (
    <Legal title="Credits">
      <h2>Instrument samples</h2>
      <p>
        {SITE.name} plays these instruments with free sample libraries. The samples were trimmed and re-encoded to MP3 for the web.
      </p>
      <ul>
        {SAMPLES.map((s) => (
          <li key={s.instrument}>
            <b>{s.instrument}</b>: {s.source}, by {s.author} (via{' '}
            <a href={s.via.url} target="_blank" rel="noreferrer">
              {s.via.label}
            </a>
            ), licensed under{' '}
            <a href={s.license.url} target="_blank" rel="noreferrer">
              {s.license.label}
            </a>
            .
          </li>
        ))}
      </ul>
      <p>The other sounds (synths and the rest of the drum kits) are generated in your browser.</p>

      <h2>Software</h2>
      <p>
        Built with{' '}
        <a href="https://tonejs.github.io" target="_blank" rel="noreferrer">
          Tone.js
        </a>
        ,{' '}
        <a href="https://github.com/Tonejs/Midi" target="_blank" rel="noreferrer">
          @tonejs/midi
        </a>
        ,{' '}
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          React
        </a>{' '}
        and{' '}
        <a href="https://github.com/pmndrs/zustand" target="_blank" rel="noreferrer">
          Zustand
        </a>
        , all under the MIT license.
      </p>
    </Legal>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© 2026 {SITE.name}</span>
      <a href="#/terms">Terms</a>
      <a href="#/privacy">Privacy</a>
      <a href="#/credits">Credits</a>
    </footer>
  );
}
