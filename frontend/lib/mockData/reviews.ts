export interface Review {
  id: string;
  propertyId: number;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  verifiedStay: boolean;
  helpfulCount: number;
}

export const mockReviews: Review[] = [
  {
    id: "r1",
    propertyId: 1,
    userName: "Emeka Obi",
    rating: 5,
    comment: "Absolutely loved staying here. The power supply is indeed 24/7 as advertised. The management is very responsive.",
    date: "2024-12-01",
    verifiedStay: true,
    helpfulCount: 12,
  },
  {
    id: "r2",
    propertyId: 1,
    userName: "Sade Adeniyi",
    rating: 4,
    comment: "Great location and very secure. The gym could be better but overall a solid 4 stars.",
    date: "2024-11-15",
    verifiedStay: true,
    helpfulCount: 8,
  },
  {
    id: "r3",
    propertyId: 1,
    userName: "John Doe",
    rating: 3,
    comment: "The apartment is nice but the noise from the street can be a bit much during the day.",
    date: "2024-10-20",
    verifiedStay: false,
    helpfulCount: 2,
  },
  {
    id: "r4",
    propertyId: 2,
    userName: "Amina Yusuf",
    rating: 5,
    comment: "Perfect for my needs. Close to everything in Wuse 2.",
    date: "2024-12-10",
    verifiedStay: true,
    helpfulCount: 5,
  },
];
