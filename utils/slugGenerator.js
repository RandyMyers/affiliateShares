/**
 * Generate a unique short slug for links
 */

const ShortLink = require('../models/ShortLink');

const CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LENGTH = 6;

/**
 * Generate a random slug
 */
const generateRandomSlug = () => {
  let slug = '';
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return slug;
};

/**
 * Generate a unique slug
 * @returns {Promise<string>} Unique slug
 */
const generateSlug = async () => {
  let slug = generateRandomSlug();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await ShortLink.findOne({ slug });
    if (!existing) {
      return slug;
    }
    slug = generateRandomSlug();
    attempts++;
  }

  // If we can't find a unique slug after max attempts, add timestamp
  return `${slug}-${Date.now().toString(36)}`;
};

module.exports = { generateSlug, generateRandomSlug };

