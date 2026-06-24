class EventPublisherObj {
  static #instance = null;
  constructor() {
    if (EventPublisherObj.#instance) {
      throw new Error('EventPublisher cannot be created! Try to use EventPublisherInstance');
    }
    EventPublisherObj.#instance = this;
  }

  #arbiters = new Map();

  addEventListener(event, arbiterName, eventDeligator)
  {
    console.log('addEventListener:' + event + '|' + arbiterName + ' is added.');
    // find event
    if (!this.#arbiters.has(event)) {
      // add event Map
      this.#arbiters.set(event, new Map());
    }
    let eventMap = this.#arbiters.get(event);
    eventMap.set(arbiterName, eventDeligator);
  }

  removeEventListener(event, arbiterName)
  {
    console.log('removeEventListener:' + event + '|' + arbiterName + ' is removed.');
    if (!this.#arbiters.has(event)) {
      return;
    }
    this.#arbiters.get(event).delete(arbiterName);
  }

  publish(event, args)
  {
    if (!this.#arbiters.has(event)) {
      return;
    }
    let eventMap = this.#arbiters.get(event);

    // eslint-disable-next-line no-unused-vars
    for (const [key, eventDeligator] of eventMap.entries()) {
      if (eventDeligator !== null) {
        eventDeligator(args);
        console.log('publish:', event, args);
      }
    }
  }
}

let EventPublisher = new EventPublisherObj();
export default EventPublisher;