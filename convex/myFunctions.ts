import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Enhanced validators for arguments with range validation.
  args: {
    count: v.optional(v.number()),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    
    // Validate count is within acceptable range
    const count = args.count ?? 10; // Default to 10
    if (count < 1 || count > 100) {
      throw new Error("Count must be between 1 and 100");
    }
    
    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(count);
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    return {
      viewer: user?.email ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Enhanced validators for arguments with range validation.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    //// Insert or modify documents in the database here.
    //// Mutations can also read from the database like queries.
    //// See https://docs.convex.dev/database/writing-data.

    // Validate the value is within acceptable range (0-99)
    if (args.value < 0 || args.value > 99) {
      throw new Error("Value must be between 0 and 99");
    }

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
    // Optionally, return a value from your mutation.
    return id;
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Enhanced validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    
    // Validate inputs
    if (args.first < 0) {
      throw new Error("First argument must be non-negative");
    }
    if (!args.second || args.second.trim().length === 0) {
      throw new Error("Second argument must be a non-empty string");
    }
    
    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

// Enhanced action: fetch random fact from an API
export const fetchRandomFact = action({
  // Validators for arguments.
  args: {},

  // Action implementation that calls a third-party API.
  handler: async () => {
    try {
      // Fetch a random cat fact from a public API
      const response = await fetch("https://catfact.ninja/fact");
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Fetched fact:", data);
      
      return {
        fact: data.fact,
        length: data.length,
      };
    } catch (error) {
      console.error("Error fetching fact:", error);
      throw new Error("Failed to fetch random fact from API");
    }
  },
});

// Enhanced action: process numbers with validation
export const processNumbers = action({
  // Enhanced validators with multiple parameters and types.
  args: {
    numbers: v.array(v.number()),
    operation: v.union(
      v.literal("sum"),
      v.literal("average"),
      v.literal("max"),
      v.literal("min")
    ),
  },

  // Action implementation with comprehensive validation.
  handler: async (ctx, args) => {
    // Validate array is not empty
    if (args.numbers.length === 0) {
      throw new Error("Numbers array cannot be empty");
    }

    // Validate all numbers are within range
    for (const num of args.numbers) {
      if (num < 0 || num > 99) {
        throw new Error("All numbers must be between 0 and 99");
      }
    }

    let result: number;
    
    switch (args.operation) {
      case "sum":
        result = args.numbers.reduce((acc, num) => acc + num, 0);
        break;
      case "average":
        result = args.numbers.reduce((acc, num) => acc + num, 0) / args.numbers.length;
        break;
      case "max":
        result = Math.max(...args.numbers);
        break;
      case "min":
        result = Math.min(...args.numbers);
        break;
      default:
        throw new Error("Invalid operation");
    }

    // Store the result (clamped to valid range 0-99)
    const clampedResult = Math.max(0, Math.min(99, Math.floor(result)));
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: clampedResult,
    });

    return {
      operation: args.operation,
      input: args.numbers,
      result: result,
    };
  },
});
