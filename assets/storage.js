export function getInt(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error(`Error getting item from localStorage: ${key}`, error);
    return 0;
  }
}

export function getString(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? value : '';
  } catch (error) {
    console.error(`Error getting item from localStorage: ${key}`, error);
    return '';
  }
}

export function getArray(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.error(`Error getting item from localStorage: ${key}`, error);
    return [];
  }
}

export function getObject(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : {};
  } catch (error) {
    console.error(`Error getting item from localStorage: ${key}`, error);
    return {};
  }
}

export function setInt(key, value) {
  try {
    localStorage.setItem(key, value.toString());
  } catch (error) {
    console.error(`Error setting item in localStorage: ${key}`, error);
  }
}

export function setString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting item in localStorage: ${key}`, error);
  }
}

export function setArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting item in localStorage: ${key}`, error);
  }
}

export function setObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting item in localStorage: ${key}`, error);
  }
}
