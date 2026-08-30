import type { ItineraryData, ItineraryRecord } from "./types";

export const SAMPLE_SLUG = "sample-three-days-paris";

// A built-in demo itinerary (in the spirit of "three perfect days in Paris"
// guides) so the app is browsable before Supabase is configured. Written for
// this app — not copied from any article.
const data: ItineraryData = {
  title: "Three Perfect Days in Paris",
  destination: "Paris, France",
  summary:
    "A demo itinerary: Left Bank classics, the Marais and Right Bank, then Montmartre and the Eiffel Tower — cafés, museums, and long walks in between.",
  days: [
    {
      day: 1,
      title: "Left Bank classics",
      stops: [
        {
          name: "Café de Flore",
          kind: "cafe",
          description:
            "Start with a café crème and tartine at the marble tables of Saint-Germain's most storied café.",
          area: "Saint-Germain-des-Prés",
          address: "172 Bd Saint-Germain, 75006 Paris",
          lat: 48.8541,
          lng: 2.3326,
          approx: false,
          time_of_day: "morning",
          tip: "Go before 9am to get a terrace table without a wait.",
        },
        {
          name: "Jardin du Luxembourg",
          kind: "sight",
          description:
            "Loop the gravel paths past the Medici Fountain and the toy sailboats on the central basin.",
          area: "6th arrondissement",
          address: "",
          lat: 48.8462,
          lng: 2.3372,
          approx: false,
          time_of_day: "morning",
          tip: "The green metal chairs are free — claim two by the fountain.",
        },
        {
          name: "Musée d'Orsay",
          kind: "museum",
          description:
            "Impressionist heavyweights inside a Beaux-Arts train station; the clock window is the classic photo.",
          area: "7th arrondissement",
          address: "Esplanade Valéry Giscard d'Estaing, 75007 Paris",
          lat: 48.86,
          lng: 2.3266,
          approx: false,
          time_of_day: "afternoon",
          tip: "Book a timed ticket online and head straight to level 5.",
        },
        {
          name: "Shakespeare and Company",
          kind: "shop",
          description:
            "The famous English-language bookshop facing Notre-Dame — creaky stairs, typewriter nooks, resident cat energy.",
          area: "Latin Quarter",
          address: "37 Rue de la Bûcherie, 75005 Paris",
          lat: 48.8526,
          lng: 2.3471,
          approx: false,
          time_of_day: "afternoon",
          tip: "They stamp the title page of any book you buy.",
        },
        {
          name: "Île de la Cité & Notre-Dame",
          kind: "sight",
          description:
            "Cross to the island for the cathedral's restored façade, then walk the quiet Square du Vert-Galant at its tip.",
          area: "Île de la Cité",
          address: "",
          lat: 48.853,
          lng: 2.3499,
          approx: false,
          time_of_day: "evening",
          tip: null,
        },
        {
          name: "Bouillon Racine",
          kind: "restaurant",
          description:
            "Art Nouveau dining room serving classic French bouillon fare at friendly prices.",
          area: "6th arrondissement",
          address: "3 Rue Racine, 75006 Paris",
          lat: 48.851,
          lng: 2.3437,
          approx: false,
          time_of_day: "evening",
          tip: "Reserve — the 8pm seating fills up fastest.",
        },
      ],
    },
    {
      day: 2,
      title: "Marais & Right Bank",
      stops: [
        {
          name: "Du Pain et des Idées",
          kind: "bakery",
          description:
            "Beloved 1889 bakery near Canal Saint-Martin; the escargot pastries and pain des amis are the move.",
          area: "10th arrondissement",
          address: "34 Rue Yves Toudic, 75010 Paris",
          lat: 48.871,
          lng: 2.3627,
          approx: false,
          time_of_day: "morning",
          tip: "Closed weekends — line up before 10am on weekdays.",
        },
        {
          name: "Musée Picasso",
          kind: "museum",
          description:
            "A hôtel particulier in the Marais stacked with Picasso across every period.",
          area: "Le Marais",
          address: "5 Rue de Thorigny, 75003 Paris",
          lat: 48.8598,
          lng: 2.3622,
          approx: false,
          time_of_day: "morning",
          tip: null,
        },
        {
          name: "Place des Vosges",
          kind: "sight",
          description:
            "Paris's oldest planned square — brick arcades, symmetrical lawns, perfect picnic geometry.",
          area: "Le Marais",
          address: "",
          lat: 48.8556,
          lng: 2.3655,
          approx: false,
          time_of_day: "afternoon",
          tip: "Duck into the arcades' galleries when it drizzles.",
        },
        {
          name: "L'As du Fallafel",
          kind: "restaurant",
          description:
            "The Rue des Rosiers falafel institution; the green-sauced special is worth the queue.",
          area: "Le Marais",
          address: "34 Rue des Rosiers, 75004 Paris",
          lat: 48.8572,
          lng: 2.3591,
          approx: false,
          time_of_day: "afternoon",
          tip: "The takeaway window moves much faster than table service.",
        },
        {
          name: "Palais-Royal Gardens",
          kind: "sight",
          description:
            "Striped Buren columns, manicured allées, and arcade boutiques hidden behind the Louvre.",
          area: "1st arrondissement",
          address: "",
          lat: 48.8637,
          lng: 2.3371,
          approx: false,
          time_of_day: "evening",
          tip: null,
        },
        {
          name: "Little Red Door",
          kind: "bar",
          description:
            "A world-ranked Marais cocktail den with a menu that changes by concept each year.",
          area: "Le Marais",
          address: "60 Rue Charlot, 75003 Paris",
          lat: 48.8637,
          lng: 2.3639,
          approx: false,
          time_of_day: "evening",
          tip: "Walk-ins only early in the evening; it's tiny.",
        },
      ],
    },
    {
      day: 3,
      title: "Montmartre to the Eiffel Tower",
      stops: [
        {
          name: "Sacré-Cœur",
          kind: "sight",
          description:
            "Climb (or funicular) to the white basilica for the best free panorama over the city.",
          area: "Montmartre",
          address: "35 Rue du Chevalier de la Barre, 75018 Paris",
          lat: 48.8867,
          lng: 2.3431,
          approx: false,
          time_of_day: "morning",
          tip: "Arrive before 9am to beat both crowds and haze.",
        },
        {
          name: "Place du Tertre",
          kind: "sight",
          description:
            "Montmartre's painters' square — touristy, yes, but the side streets around it are the real charm.",
          area: "Montmartre",
          address: "",
          lat: 48.8865,
          lng: 2.3407,
          approx: false,
          time_of_day: "morning",
          tip: "Detour down Rue de l'Abreuvoir for the prettiest street in the quarter.",
        },
        {
          name: "Hardware Société",
          kind: "cafe",
          description:
            "Australian-style brunch at the foot of Sacré-Cœur; expect serious coffee.",
          area: "Montmartre",
          address: "10 Rue Lamarck, 75018 Paris",
          lat: 48.8842,
          lng: 2.3406,
          approx: false,
          time_of_day: "afternoon",
          tip: null,
        },
        {
          name: "Palais de Tokyo",
          kind: "museum",
          description:
            "Sprawling contemporary art space with a riverside terrace and a great bookshop.",
          area: "16th arrondissement",
          address: "13 Av. du Président Wilson, 75116 Paris",
          lat: 48.8642,
          lng: 2.2966,
          approx: false,
          time_of_day: "afternoon",
          tip: "Open till midnight most days — save it for a late slot if you're running behind.",
        },
        {
          name: "Trocadéro esplanade",
          kind: "viewpoint",
          description:
            "The head-on Eiffel Tower view across the river — golden hour is the moment.",
          area: "16th arrondissement",
          address: "",
          lat: 48.862,
          lng: 2.2873,
          approx: false,
          time_of_day: "evening",
          tip: null,
        },
        {
          name: "Eiffel Tower",
          kind: "sight",
          description:
            "Finish under the tower for the sparkle — it glitters for five minutes on the hour after dark.",
          area: "7th arrondissement",
          address: "Champ de Mars, 5 Av. Anatole France, 75007 Paris",
          lat: 48.8584,
          lng: 2.2945,
          approx: false,
          time_of_day: "evening",
          tip: "Book summit tickets weeks ahead, or just picnic on the Champ de Mars.",
        },
      ],
    },
  ],
  tips: [
    "Buy a carnet of metro tickets (or use contactless) — the metro beats taxis for nearly every hop here.",
    "Most museums are closed either Monday or Tuesday; check before you build your day around one.",
    "Dinner reservations matter: book the sit-down spots a few days out.",
  ],
};

export const sampleItinerary: ItineraryRecord = {
  id: "sample",
  slug: SAMPLE_SLUG,
  title: data.title,
  destination: data.destination,
  source_url: null,
  data,
  created_at: "2026-01-01T00:00:00Z",
};
