import { GnuBgHints, RatingCategory } from '../src'

describe('Performance Rating (PR) Calculation', () => {
  describe('getRelativeFibsRating', () => {
    it('should return a finite number for valid inputs', () => {
      const rating = GnuBgHints.getRelativeFibsRating(0.5, 100)
      expect(Number.isFinite(rating)).toBe(true)
    })

    it('should return -2100 for edge case inputs (n <= 0)', () => {
      const rating = GnuBgHints.getRelativeFibsRating(0.5, 0)
      expect(rating).toBe(-2100)
    })

    it('should return -2100 for edge case inputs (r <= 0)', () => {
      const rating = GnuBgHints.getRelativeFibsRating(0, 100)
      expect(rating).toBe(-2100)
    })

    it('should return -2100 for edge case inputs (r >= 1)', () => {
      const rating = GnuBgHints.getRelativeFibsRating(1, 100)
      expect(rating).toBe(-2100)
    })

    it('should return 0 for error rate of 0.5 (the logistic midpoint)', () => {
      // log10(1/0.5 - 1) = log10(1) = 0, so result = 0
      const rating = GnuBgHints.getRelativeFibsRating(0.5, 100)
      expect(rating).toBeCloseTo(0, 1)
    })

    it('should return positive for high error rates (> 0.5)', () => {
      // Formula: -2000/sqrt(n) * log10(1/r - 1)
      // For r=0.8: 1/0.8 - 1 = 0.25, log10(0.25) < 0, so result is positive
      const rating = GnuBgHints.getRelativeFibsRating(0.8, 100)
      expect(rating).toBeGreaterThan(0)
    })

    it('should return negative for low error rates (< 0.5)', () => {
      // For r=0.2: 1/0.2 - 1 = 4, log10(4) > 0, so result is negative
      const rating = GnuBgHints.getRelativeFibsRating(0.2, 100)
      expect(rating).toBeLessThan(0)
    })
  })

  describe('getAbsoluteFibsRatingChequer', () => {
    it('should return a finite number for valid inputs', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingChequer(0.01, 100)
      expect(Number.isFinite(loss)).toBe(true)
    })

    it('should return 0 for zero error', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingChequer(0, 100)
      expect(loss).toBe(0)
    })

    it('should return 0 for n <= 0', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingChequer(0.01, 0)
      expect(loss).toBe(0)
    })

    it('should increase with higher error', () => {
      const low = GnuBgHints.getAbsoluteFibsRatingChequer(0.005, 100)
      const high = GnuBgHints.getAbsoluteFibsRatingChequer(0.02, 100)
      expect(high).toBeGreaterThan(low)
    })
  })

  describe('getAbsoluteFibsRatingCube', () => {
    it('should return a finite number for valid inputs', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingCube(0.01, 100)
      expect(Number.isFinite(loss)).toBe(true)
    })

    it('should return 0 for zero error', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingCube(0, 100)
      expect(loss).toBe(0)
    })

    it('should return 0 for n <= 0', () => {
      const loss = GnuBgHints.getAbsoluteFibsRatingCube(0.01, 0)
      expect(loss).toBe(0)
    })
  })

  describe('getAbsoluteFibsRating', () => {
    it('should return a rating near offset for zero errors', () => {
      const rating = GnuBgHints.getAbsoluteFibsRating(0, 0, 100, 2100)
      expect(rating).toBeCloseTo(2100, 1)
    })

    it('should return lower rating with higher errors', () => {
      const good = GnuBgHints.getAbsoluteFibsRating(0.005, 0.005, 100, 2100)
      const bad = GnuBgHints.getAbsoluteFibsRating(0.02, 0.02, 100, 2100)
      expect(bad).toBeLessThan(good)
    })

    it('should respect the rating offset parameter', () => {
      const low = GnuBgHints.getAbsoluteFibsRating(0.01, 0.01, 100, 1500)
      const high = GnuBgHints.getAbsoluteFibsRating(0.01, 0.01, 100, 2100)
      expect(high).toBeGreaterThan(low)
    })
  })

  describe('getRatingCategory', () => {
    it('should return Supernatural for very low error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.001)
      expect(result.category).toBe(RatingCategory.Supernatural)
      expect(result.name).toBe('Supernatural')
    })

    it('should return WorldClass for low error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.004)
      expect(result.category).toBe(RatingCategory.WorldClass)
      expect(result.name).toBe('World class')
    })

    it('should return Expert for moderate-low error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.007)
      expect(result.category).toBe(RatingCategory.Expert)
      expect(result.name).toBe('Expert')
    })

    it('should return Advanced for moderate error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.01)
      expect(result.category).toBe(RatingCategory.Advanced)
      expect(result.name).toBe('Advanced')
    })

    it('should return Intermediate for higher error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.015)
      expect(result.category).toBe(RatingCategory.Intermediate)
      expect(result.name).toBe('Intermediate')
    })

    it('should return CasualPlayer for even higher error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.022)
      expect(result.category).toBe(RatingCategory.CasualPlayer)
      expect(result.name).toBe('Casual player')
    })

    it('should return Beginner for high error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.03)
      expect(result.category).toBe(RatingCategory.Beginner)
      expect(result.name).toBe('Beginner')
    })

    it('should return Awful for very high error rate', () => {
      const result = GnuBgHints.getRatingCategory(0.05)
      expect(result.category).toBe(RatingCategory.Awful)
      expect(result.name).toBe('Awful')
    })

    it('should return an object with category and name', () => {
      const result = GnuBgHints.getRatingCategory(0.01)
      expect(result).toHaveProperty('category')
      expect(result).toHaveProperty('name')
      expect(typeof result.category).toBe('number')
      expect(typeof result.name).toBe('string')
    })
  })
})
