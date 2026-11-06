import { EventAvailability, EventItem, EventUpdate, EventWithAvailability, NewEvent } from '../models';

export abstract class EventsService {
  abstract list(): Promise<EventWithAvailability[]>;         // listed only, with availability
  abstract listAll(): Promise<EventItem[]>;                  // admin: every event
  abstract get(id: number): Promise<EventItem>;
  abstract availability(eventId: number): Promise<EventAvailability>;
  abstract create(e: NewEvent): Promise<EventItem>;
  abstract update(id: number, changes: EventUpdate): Promise<EventItem>;
  abstract close(id: number): Promise<EventItem>;
  abstract reopen(id: number): Promise<EventItem>;
  abstract finalize(id: number): Promise<EventItem>;         // cancel no-shows + close
}