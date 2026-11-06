import { Attendee, MyTicket, Registration } from '../models';

export abstract class RegistrationsService {
  abstract register(eventId: number): Promise<Registration>;
  abstract cancel(registrationId: number): Promise<Registration>;
  abstract markNoShow(registrationId: number): Promise<Registration>;
  abstract myTickets(): Promise<MyTicket[]>;
  abstract listForEvent(eventId: number): Promise<Attendee[]>;
}