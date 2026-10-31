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
  .uuid()
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

// ─── POST /chat/:chatId/message/send ─────────────────────────────────────────

export const sendMessageSchema = Joi.object({
  senderId: uuid.required().messages({
    'string.guid':  'senderId must be a valid UUID',
    'any.required': 'senderId is required',
  }),
  text: Joi.string().trim().min(1).max(5000).required().messages({
    'string.empty': 'text cannot be empty',
    'string.max':   'text cannot exceed 5000 characters',
    'any.required': 'text is required',
  }),
});

export const getMessagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    'number.base': 'limit must be a number',
    'number.integer': 'limit must be an integer',
    'number.min': 'limit must be at least 1',
    'number.max': 'limit cannot exceed 100',
  }),
  cursor: Joi.string().trim().optional(),
  before: Joi.string().trim().optional(),
  userId: uuid.optional().messages({
    'string.guid': 'userId must be a valid UUID',
  }),
});

export const markMessageReadSchema = Joi.object({
  userId: uuid.required().messages({
    'string.guid':  'userId must be a valid UUID',
    'any.required': 'userId is required',
  }),
});

export const markMessageReadParamSchema = Joi.object({
  chatId: uuid.required().messages({
    'string.guid':  'chatId must be a valid UUID',
    'any.required': 'chatId is required',
  }),
  messageId: Joi.string().trim().min(1).required().messages({
    'string.empty': 'messageId cannot be empty',
    'any.required': 'messageId is required',
  }),
});

export const updateLastSeenSchema = Joi.object({
  userId: uuid.required().messages({
    'string.guid':  'userId must be a valid UUID',
    'any.required': 'userId is required',
  }),
  messageId: Joi.string().trim().min(1).required().messages({
    'string.empty': 'messageId cannot be empty',
    'any.required': 'messageId is required',
  }),
});
