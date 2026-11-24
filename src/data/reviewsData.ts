export interface GoogleReviewItem {
  id: string;
  reviewerName: string;
  reviewerMeta: string;
  rating: 5;
  timeAgo: string;
  dishMentioned: string;
  quote: string;
  initials: string;
}

export const GOOGLE_REVIEWS: GoogleReviewItem[] = [
  {
    id: 'rev-1',
    reviewerName: 'Srinivasulu Reddy',
    reviewerMeta: 'Local Guide · 42 reviews',
    rating: 5,
    timeAgo: '4 days ago',
    dishMentioned: 'Ulavacharu Kodi Biryani',
    quote:
      'The earthen claypot Ulavacharu Biryani arrives steaming at the table with a depth of roasted horsegram and saffron you simply cannot find anywhere else in Madhuravada.',
    initials: 'SR',
  },
  {
    id: 'rev-2',
    reviewerName: 'Lakshmi Narayana',
    reviewerMeta: 'Local Guide · 28 reviews',
    rating: 5,
    timeAgo: '1 week ago',
    dishMentioned: 'Gongura Mamsam & Kodi Vepudu',
    quote:
      'Finally an upscale dining room in Visakhapatnam that refuses to water down authentic Guntur heat. Tangy crimson gongura with tender lamb was extraordinary.',
    initials: 'LN',
  },
  {
    id: 'rev-3',
    reviewerName: 'Dr. Madhavi Varma',
    reviewerMeta: 'Verified Diner · 16 reviews',
    rating: 5,
    timeAgo: '2 weeks ago',
    dishMentioned: 'Bhimavaram Royyala Iguru',
    quote:
      'Calm obsidian lighting, attentive hosts, and coastal prawns caramelized to perfection. We hosted our parents’ anniversary dinner here and every course felt memorable.',
    initials: 'MV',
  },
  {
    id: 'rev-4',
    reviewerName: 'Karthikeya Raju',
    reviewerMeta: 'Local Guide · 64 reviews',
    rating: 5,
    timeAgo: '3 weeks ago',
    dishMentioned: 'Gutti Vankaya & Pootharekulu',
    quote:
      'Even the vegetarian dishes shine with heirloom sesame-peanut gravy, and ending with warm cardamom kahwa and paper-thin Atreyapuram Pootharekulu was pure nostalgia.',
    initials: 'KR',
  },
  {
    id: 'rev-5',
    reviewerName: 'Anusha Chakravarthy',
    reviewerMeta: 'Verified Diner · 19 reviews',
    rating: 5,
    timeAgo: '1 month ago',
    dishMentioned: 'Rayalaseema Mamsam Handi',
    quote:
      'Booked 24 hours ahead on WhatsApp and our corner table was ready to the minute. Smoky wood-ember aromas and impeccable pacing between starters and claypot dum.',
    initials: 'AC',
  },
];
