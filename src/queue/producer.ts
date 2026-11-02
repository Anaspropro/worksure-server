import { emailQueue, EmailJobPriority, EmailJobData } from './queue';

export class EmailProducer {
  /**
   * Send a high priority VIP welcome email
   */
  static async sendWelcomeEmail(data: EmailJobData) {
    console.log(`[Producer] Adding VIP Welcome Email for ${data.to}`);
    return await emailQueue.add('sendWelcomeEmail', data, {
      priority: EmailJobPriority.VIP,
    });
  }

  /**
   * Send a delayed onboarding email
   * @param data Email data
   * @param delayMs Delay in milliseconds (e.g., 3600000 for 1 hour)
   */
  static async sendOnboardingEmail(data: EmailJobData, delayMs: number) {
    console.log(
      `[Producer] Adding Delayed Onboarding Email for ${data.to} (Delay: ${delayMs}ms)`,
    );
    return await emailQueue.add('sendOnboardingEmail', data, {
      priority: EmailJobPriority.NORMAL,
      delay: delayMs,
    });
  }

  /**
   * Send a low priority bulk marketing email
   */
  static async sendMarketingEmail(data: EmailJobData) {
    console.log(
      `[Producer] Adding Low Priority Marketing Email for ${data.to}`,
    );
    return await emailQueue.add('sendMarketingEmail', data, {
      priority: EmailJobPriority.LOW,
    });
  }

  static async sendVerificationOtp(data: EmailJobData & { token: string }) {
    console.log(`[Producer] Adding Verification OTP Email for ${data.to}`);
    return await emailQueue.add('sendVerificationOtp', data, {
      priority: EmailJobPriority.VIP,
    });
  }

  static async sendPasswordReset(data: EmailJobData & { token: string }) {
    console.log(`[Producer] Adding Password Reset Email for ${data.to}`);
    return await emailQueue.add('sendPasswordReset', data, {
      priority: EmailJobPriority.VIP,
    });
  }
}

// Example execution if file is run directly (node src/queue/producer.js)
if (require.main === module) {
  (async () => {
    try {
      console.log('[Producer] Generating sample jobs...');

      // 1. VIP Welcome Email
      await EmailProducer.sendWelcomeEmail({
        to: 'vip@example.com',
        name: 'Alice VIP',
      });

      // 2. Delayed Onboarding Email (10 seconds delay)
      await EmailProducer.sendOnboardingEmail(
        {
          to: 'newuser@example.com',
          name: 'Bob New',
        },
        10000,
      );

      // 3. Bulk Marketing Emails
      await EmailProducer.sendMarketingEmail({
        to: 'bulk1@example.com',
        name: 'Charlie Bulk 1',
      });
      await EmailProducer.sendMarketingEmail({
        to: 'bulk2@example.com',
        name: 'David Bulk 2',
      });

      console.log('[Producer] All example jobs added to the queue');
    } catch (error) {
      console.error('[Producer] Failed to add jobs:', error);
    } finally {
      process.exit(0);
    }
  })();
}
