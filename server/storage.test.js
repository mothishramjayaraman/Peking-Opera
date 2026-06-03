import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// ESM requires unstable_mockModule instead of jest.mock
jest.unstable_mockModule('./db.js', () => ({
  db: {
    select: jest.fn().mockReturnThis(),  // returns db mock itself to allow chaining
    from: jest.fn().mockReturnThis(),    // same — enables db.select().from()
    where: jest.fn().mockReturnThis(),   // same — enables .where() chaining
    limit: jest.fn().mockResolvedValue([]),   // resolves to empty array by default
    insert: jest.fn().mockReturnThis(),  // chainable insert
    values: jest.fn().mockReturnThis(),  // chainable values
    returning: jest.fn().mockResolvedValue([{ id: 'test-user-id', name: 'Test User' }]), // default return after insert
  },
  pool: {
    query: jest.fn(), // raw SQL query mock (unused in these tests)
  }
}));

// dynamic import must come AFTER unstable_mockModule
// so storage.js receives the mocked db, not the real one
const { DatabaseStorage } = await import('./storage.js');

describe('DatabaseStorage', () => {
  let storage;

  // create a fresh DatabaseStorage instance before each test
  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks(); // reset call history so tests don't bleed into each other
  });

  test('getUser should return undefined if user not found', async () => {
    const { db } = await import('./db.js');
    // getUser chain ends at .where() — mock that to return empty array
    db.where.mockResolvedValueOnce([]); // empty array → destructured user = undefined

    const user = await storage.getUser('non-existent-id');
    expect(user).toBeUndefined();
  });

  test('createUser should insert and return the new user', async () => {
    const { db } = await import('./db.js');
    const mockUser = { id: 'test-user-id', name: 'Test User', email: 'test@example.com' };
    // override default returning mock to return our specific user
    db.returning.mockResolvedValueOnce([mockUser]);

    const user = await storage.createUser({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      experienceLevel: 'beginner'
    });

    expect(user).toBeDefined();
    expect(user.name).toBe('Test User');
  });

  // Example of AI testing logic for streak calculation
  test('updateStreak should correctly calculate calendar days', async () => {
    // mock getUser to simulate a user who practiced yesterday
    storage.getUser = jest.fn().mockResolvedValue({
      id: 'test-user-id',
      streak: 1,
      lastPracticeDate: new Date(new Date().setDate(new Date().getDate() - 1)) // Yesterday
    });
    storage.updateUser = jest.fn().mockResolvedValue({});

    await storage.updateStreak('test-user-id');

    // yesterday + today = streak should increment from 1 → 2
    expect(storage.updateUser).toHaveBeenCalledWith('test-user-id', expect.objectContaining({
      streak: 2
    }));
  });
});
