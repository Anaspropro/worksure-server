import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().port().default(8000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  
  // Paystack
  PAYSTACK_SECRET: Joi.string().required(),
  PAYSTACK_PUBLIC: Joi.string().required(),
  
  // Cloudinary
  CLOUDINARY_NAME: Joi.string().required(),
  CLOUDINARY_KEY: Joi.string().required(),
  CLOUDINARY_SECRET: Joi.string().required(),
  
  // App specific
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  TRUST_PROXY: Joi.string().valid('true', 'false').default('false'),
});
