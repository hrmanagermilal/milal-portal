class DataMartObj {
  static #instance = null;
  constructor() {
    if (DataMartObj.#instance) {
      throw new Error('DataMart cannot be created! Try to use DataMartInstance');
    }
    DataMartObj.#instance = this;
  }

  #data = new Map();
  
  set(key, value) {
    this.#data.set(key, value);
  }
  
  get(key) {
    if (!this.#data.has(key)) {
      return undefined;
    }
    return this.#data.get(key);
  }

  // User info related methods
  setCurrentUser(userInfo) {
    this.#data.set('currentUser', userInfo);
  }

  getCurrentUser() {
    return this.#data.get('currentUser');
  }

  clearCurrentUser() {
    this.#data.delete('currentUser');
  }
}

let DataMart = new DataMartObj();
export default DataMart;