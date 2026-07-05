import { Injectable } from '@nestjs/common';
import { DomainEventName } from '../../common/events/domain.events';

export interface NotificationContent {
  title: string;
  message: string;
  emailSubject?: string;
  emailBody?: string;
}

@Injectable()
export class NotificationTemplateService {
  /**
   * Interpolates variables into a template string
   * e.g. interpolate('Hello {name}', { name: 'World' }) => 'Hello World'
   */
  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Generates the notification content for a given domain event
   */
  public generate(eventName: DomainEventName, variables: Record<string, any>): NotificationContent {
    switch (eventName) {
      case DomainEventName.JOB_POSTED:
        return {
          title: 'Job Posted',
          message: this.interpolate('Your job "{jobTitle}" has been successfully posted.', variables),
          emailSubject: this.interpolate('Job Posted: {jobTitle}', variables),
          emailBody: this.interpolate('Your job "{jobTitle}" has been successfully posted and is now visible to artisans.', variables),
        };

      case DomainEventName.PROPOSAL_SUBMITTED:
        return {
          title: 'New Proposal Received',
          message: this.interpolate('You have received a new proposal for {jobTitle}.', variables),
          emailSubject: this.interpolate('New Proposal for {jobTitle}', variables),
          emailBody: this.interpolate('A new proposal has been submitted for your job "{jobTitle}". Log in to review it.', variables),
        };

      case DomainEventName.PROPOSAL_ACCEPTED:
        return {
          title: 'Proposal Accepted',
          message: this.interpolate('Congratulations! Your proposal for {jobTitle} has been accepted.', variables),
          emailSubject: this.interpolate('Proposal Accepted: {jobTitle}', variables),
          emailBody: this.interpolate('Congratulations! The client has accepted your proposal for the job "{jobTitle}".', variables),
        };

      case DomainEventName.CONTRACT_FUNDED:
        return {
          title: 'Contract Funded',
          message: this.interpolate('The client has funded the escrow for {jobTitle}. You may now begin work.', variables),
          emailSubject: this.interpolate('Contract Funded: {jobTitle}', variables),
          emailBody: this.interpolate('The escrow for contract {contractReference} ({jobTitle}) has been fully funded. You can now securely begin work.', variables),
        };

      case DomainEventName.PAYMENT_PROCESSED:
        return {
          title: 'Payment Released',
          message: this.interpolate('Your payment for {jobTitle} has been successfully released to your wallet.', variables),
          emailSubject: this.interpolate('Payment Released: {jobTitle}', variables),
          emailBody: this.interpolate('Funds for the job "{jobTitle}" have been released from escrow and added to your wallet balance.', variables),
        };

      case DomainEventName.DISPUTE_RAISED:
        return {
          title: 'Dispute Opened',
          message: this.interpolate('A dispute has been opened for contract {contractReference}. Our team will review it shortly.', variables),
          emailSubject: this.interpolate('Dispute Opened for Contract {contractReference}', variables),
          emailBody: this.interpolate('A dispute has been initiated for contract {contractReference}. An administrator will be assigned to review the case. Please check the platform for updates.', variables),
        };

      default:
        return {
          title: 'Notification',
          message: 'You have a new notification.',
          emailSubject: 'New Notification',
          emailBody: 'You have a new notification on WorkSure.',
        };
    }
  }
}
