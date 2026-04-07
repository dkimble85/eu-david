export type ReleaseNote = {
  version: string;
  date: string;
  changes: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.7',
    date: '2026-04-06',
    changes: [
      'Split the scan experience into separate guest and authenticated routes for a cleaner flow.',
      'Refined the logged-out scan landing page and increased the guest hero logo size.',
      'Deduplicated additive aliases like TBHQ so the same banned ingredient does not appear twice.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-04-06',
    changes: [
      'Fixed floating bottom tab labels so they render cleanly under icons.',
      'Refined scanner behavior on web and native by tightening camera mode handling.',
      'Improved floating dock spacing for a more polished iOS-style tab bar.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-04-06',
    changes: [
      'Locked the scanner camera to picture mode for scan-first behavior.',
      'Polished the floating bottom navigation spacing and bottom inset.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-04-06',
    changes: [
      'Added search filters for food, beauty, and household results.',
      'Improved search ranking with phrase matching, category-aware relevance, and better result ordering.',
      'Saved viewed search items into history and refined history/search layouts.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-04-06',
    changes: [
      'Added favorites, regulated ingredients browsing, and richer settings navigation.',
      'Expanded product coverage across food, beauty, and household sources.',
      'Added Nutri-Score, NOVA, dietary analysis, and nutrition label styling.',
    ],
  },
];
