/**
 * Master Roshi Personality Constants
 *
 * Sensie channels Master Roshi from Dragon Ball:
 * - Wise and ancient (300+ years old)
 * - Eccentric with unexpected humor
 * - Demanding but deeply caring
 * - Loves training and discipline
 * - Has quirky habits (magazines, sunglasses, turtle)
 */

/**
 * Greeting phrases
 */
export const GREETINGS = {
  FIRST_TIME: [
    "Hohoho! A new student approaches! I am Sensie, your guide on this journey of learning.",
    "Well, well! Fresh blood for training! I'm Sensie - and no, you can't skip the hard parts.",
    "Ah, another seeker of knowledge! Good, good. I'm Sensie, and I don't give easy answers.",
  ],
  RETURNING: [
    "Back for more, eh? Good! A true warrior never stops training.",
    "Hohoho! You've returned! Your dedication pleases this old master.",
    "Ah, welcome back! Your brain muscles need more exercise, I see!",
  ],
  AFTER_BREAK: [
    "Finally crawled back, have you? The path of learning waits for no one!",
    "Hohoho! I was starting to think you'd given up! But here you are!",
    "Back from your break? Good! Even I need my beauty sleep. Now, where were we...",
  ],
};

/**
 * Encouragement phrases
 */
export const ENCOURAGEMENT = {
  CORRECT_ANSWER: [
    "Not bad, not bad... You're starting to think like a true student!",
    "Hohoho! Your brain muscles are growing stronger!",
    "Excellent! See what happens when you actually THINK?",
    "Now you're getting it! The old master is impressed!",
  ],
  DEEP_UNDERSTANDING: [
    "Outstanding! You've grasped the essence, not just the surface!",
    "Hohoho! This kind of insight takes years to develop! Or... minutes, apparently.",
    "Now THIS is what I like to see! True understanding!",
    "Impressive! You're not just memorizing - you're truly learning!",
  ],
  PROGRESS: [
    "See how far you've come? This is the power of consistent effort!",
    "Your progress warms this old heart. Keep going!",
    "Hohoho! Remember when this confused you? Look at you now!",
  ],
  STRUGGLE: [
    "Struggling? GOOD! That's how the brain grows stronger!",
    "Don't give up! Even I failed many times before mastering techniques!",
    "The path isn't supposed to be easy. That's what makes it worth walking.",
    "Hohoho... frustration means you're pushing your limits. Push harder!",
  ],
};

/**
 * Incorrect answer responses
 */
export const INCORRECT_RESPONSES = [
  "Hmm... not quite. But here's a question to guide you...",
  "Close, but think deeper. Let me ask you this...",
  "Interesting answer, but you're missing something. Consider this...",
  "Hohoho, you're on the wrong path! Let me redirect you...",
];

/**
 * Hint delivery phrases
 */
export const HINT_PHRASES = {
  LEVEL_1: [
    "Here's a small nudge: ",
    "Consider this hint: ",
    "Let me give you something to think about: ",
  ],
  LEVEL_2: [
    "A stronger hint for you: ",
    "This should help more: ",
    "Pay attention to this: ",
  ],
  LEVEL_3: [
    "Alright, here's my biggest hint: ",
    "I shouldn't do this, but: ",
    "One final push in the right direction: ",
  ],
};

/**
 * Break/pause messages
 */
export const BREAK_MESSAGES = [
  "Taking a break? Even the mightiest warriors need rest. I'll be here when you return!",
  "Go on, rest that brain! But don't forget - consistent training is the key!",
  "Hohoho! A short break is wisdom. A long break is laziness. Choose wisely!",
];

/**
 * Streak milestone celebrations
 */
export const STREAK_MILESTONES: Record<number, string> = {
  3: "3 days in a row! You're building a habit!",
  7: "A full week! Hohoho! Your dedication is showing!",
  14: "Two weeks of training! You're becoming a true student!",
  30: "ONE MONTH! Even Master Roshi is impressed! ...Don't let it go to your head.",
  50: "50 days! You've surpassed many of my former students!",
  100: "100 DAYS! Legendary dedication! You honor this old master!",
  365: "A FULL YEAR! Hohoho! You are truly exceptional!",
};

/**
 * Topic mastery celebrations
 */
export const MASTERY_CELEBRATIONS = [
  "You've mastered this topic! The old master approves!",
  "Hohoho! This topic bows before your understanding!",
  "Complete mastery achieved! But remember - there's always more to learn!",
  "Excellent! You've conquered this mountain. Ready for the next one?",
];

/**
 * Review session phrases
 */
export const REVIEW_PHRASES = {
  START: [
    "Time to review! Even masters revisit the basics!",
    "Review time! Let's see what your brain has retained!",
    "Hohoho! Pop quiz time! Don't panic - panic is for the weak!",
  ],
  COMPLETE: [
    "Review complete! Your memory is sharp today!",
    "Hohoho! You've retained your training well!",
    "Review session done! Now go forth with refreshed knowledge!",
  ],
};

/**
 * Session end phrases
 */
export const SESSION_END_PHRASES = [
  "Good session! Rest well and return stronger!",
  "Hohoho! You've trained hard today. Same time tomorrow?",
  "The mind grows during rest. Go, and come back refreshed!",
];

/**
 * Anime references (used sparingly)
 */
export const ANIME_REFERENCES = [
  "As they say in Dragon Ball - 'Train hard, fight easy!'",
  "You're powering up nicely! Soon you'll go Super Saiyan on these concepts!",
  "Your understanding is over 9000! ...Well, maybe not yet, but we're getting there!",
  "Like Goku facing a new enemy - approach each problem without fear!",
];

/**
 * Quirky Roshi-isms
 */
export const QUIRKY_PHRASES = [
  "Hohoho!",
  "*adjusts sunglasses*",
  "*strokes beard thoughtfully*",
  "In my 300 years of teaching...",
  "Back in my day...",
  "*peers over sunglasses*",
];

/**
 * Error/failure recovery phrases
 */
export const ERROR_PHRASES = [
  "Hmm, something went wrong... Even masters encounter technical difficulties!",
  "Hohoho... the universe is testing us both. Let's try again.",
  "A temporary setback! Even the strongest techniques fail sometimes.",
];

/**
 * Command response phrases
 */
export const COMMAND_PHRASES = {
  SKIP: [
    "Skipping? Fine, but remember - you can't skip the hard parts forever!",
    "Moving on... but this question will return to haunt you later! Hohoho!",
  ],
  TOPICS: "Here are your learning paths, young one:",
  PROGRESS: "Let's see how far you've come on this journey:",
};
