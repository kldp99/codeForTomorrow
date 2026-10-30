/**
 * Joi validation schemas for all API request inputs.
 *
 * All schemas are used by the `validate` middleware before requests
 * reach controllers — invalid input is rejected with 400 before any
 * database access occurs.
 */

import Joi from 'joi';

/**
 * Reusable UUID schema — accepts v3, v4, and v5 UUIDs (case-insensitive).
 */
const uuid = Joi.string()
  .uuid({ version: ['uuidv4', 'uuidv3', 'uuidv5'] })
  .lowercase()
  .trim();

// ─── POST /api/v1/user ────────────────────────────────────────────────────────

export const createUserSchema = Joi.object({
  id: uuid.optional().messages({
    'string.guid': 'id must be a valid UUID',
  }),
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty':   'name cannot be empty',
    'string.max':     'name cannot exceed 100 characters',
    'any.required':   'name is required',
  }),
  email: Joi.string().email().trim().lowercase().optional().allow(null).messages({
    'string.email': 'email must be a valid email address',
  }),
});

// ─── POST /api/v1/chat/create ────────────────────────────────────────────────

export const createChatSchema = Joi.object({
  userAId: uuid.required().messages({
    'string.guid':  'userAId must be a valid UUID',
    'any.required': 'userAId is required',
  }),
  userBId: uuid
    .required()
    .invalid(Joi.ref('userAId'))   // prevents self-chat at the validation layer
    .messages({
      'string.guid':  'userBId must be a valid UUID',
      'any.required': 'userBId is required',
      'any.invalid':  'userAId and userBId must be different users',
    }),
});

// ─── Route params ──────────────────────────────────────────────────────────

export const userIdParamSchema = Joi.object({
  userId: uuid.required().messages({
    'string.guid':  'userId must be a valid UUID',
    'any.required': 'userId is required',
  }),
});

export const chatIdParamSchema = Joi.object({
  chatId: uuid.required().messages({
    'string.guid':  'chatId must be a valid UUID',
    'any.required': 'chatId is required',
  }),
});

// ─── Legacy schemas (kept for future Firebase message routes) ────────────────

export const sendMessageSchema = Joi.object({
  sender_id: uuid.required().messages({
    'string.guid':  'sender_id must be a valid UUID',
    'any.required': 'sender_id is required',
  }),
  content: Joi.string().trim().min(1).max(4000).required().messages({
    'string.empty': 'content cannot be empty',
    'string.max':   'content cannot exceed 4000 characters',
    'any.required': 'content is required',
  }),
});

export const getMessagesQuerySchema = Joi.object({
  limit:  Joi.number().integer().min(1).max(100).default(50),
  before: Joi.string().trim().optional(),   // Firestore doc ID cursor
});

export const readReceiptSchema = Joi.object({
  user_id: uuid.required().messages({
    'string.guid':  'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
});

export const lastSeenSchema = Joi.object({
  user_id: uuid.required().messages({
    'string.guid':  'user_id must be a valid UUID',
    'any.required': 'user_id is required',
  }),
  message_id: Joi.string().trim().min(1).required().messages({
    'string.empty': 'message_id cannot be empty',
    'any.required': 'message_id is required',
  }),
});

export const messageIdParamSchema = Joi.object({
  chatId:    uuid.required(),
  messageId: Joi.string().trim().min(1).required(),
});
