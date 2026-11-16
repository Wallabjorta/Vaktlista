export const HEIS_LIFTS = [
  { code: 'AB', name: 'Bunn Olympic Express' },
  { code: 'AT', name: 'Topp Olympic Express' },
  { code: 'B', name: 'Billett Mellomstasjon' },
  { code: 'B2', name: 'Billett Mellomstasjon, 2 på jobb' },
  { code: 'BB', name: 'Bunn Kvitfjell Express' },
  { code: 'BK', name: 'Billett Kveld' },
  { code: 'BM', name: 'Bakkemand ved redning' },
  { code: 'BT', name: 'Topp Kvitfjell Express' },
  { code: 'CB', name: 'Bunn Vestsiden Express' },
  { code: 'CT', name: 'Topp Vestsiden Express' },
  { code: 'D', name: 'Dag' },
  { code: 'Ds', name: 'Dag snø' },
  { code: 'E', name: 'Familieheisen' },
  { code: 'G', name: 'Barneheisen Mellomstasjon' },
  { code: 'H', name: 'Fjellheisen' },
  { code: 'HD', name: 'Hotellheisen' },
  { code: 'I', name: 'Barneheisen Vestsiden' },
  { code: 'K', name: 'Oleheisen' },
  { code: 'Ks', name: 'Kveld snø' },
  { code: 'L', name: 'Løypekjøring' },
  { code: 'N', name: 'Natt' },
  { code: 'P', name: 'Prepp' },
  { code: 'RM', name: 'Redningsmann' },
  { code: 'S', name: 'Skipatrulje' },
  { code: 'S/K', name: 'Skipatrulje Kveld' },
  { code: 'V', name: 'Billett Skitorget' },
  { code: 'V2', name: 'Billett Skitorget, 2 på jobb' },
  { code: 'WC', name: 'World Cup' },
  { code: 'AØ', name: 'Automat øst' },
  { code: 'AV', name: 'Automat vest' }
];

export const isHeisDeptName = (name) => (name || '').toLowerCase().includes('heis');

export const heisLiftName = (code) => (HEIS_LIFTS.find(l => l.code === code)?.name) || code || '';
