
const exportedMethods = {
  getCurDate(inclTime){
    if(inclTime != true && inclTime != false){
      throw 'getCurDate: Input must be a bool'
    }

    let currentDate = new Date();
    let month = String(currentDate.getMonth() + 1).padStart(2, '0');
    let day = String(currentDate.getDate()).padStart(2, '0');
    let year = String(currentDate.getFullYear());
    let hours = String(currentDate.getHours());
    let minutes = String(currentDate.getMinutes());
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, '0');
    minutes = minutes.padStart(2, '0');

    if (inclTime) {
        return `${month}/${day}/${year} ${hours}:${minutes}${ampm}`;
    } else {
        return `${month}/${day}/${year}`;
    }
  },

  validate(type, value) {
  const checkString = (str, name) => {
    if (str === undefined || str === null) {
      throw `You must provide a ${name}`;
    }
    if (typeof str !== 'string') {
      throw `${name} must be a string`;
    }
    const trimmed = str.trim();
    if (trimmed.length === 0) {
      throw `${name} cannot be an empty string or just spaces`;
    }

    return trimmed;
  };

  switch (type) {
    case 'string': {
      const varName = 'value';
      return checkString(value, varName);

    }

    case 'name': {
      const varName = 'name';
      const name = checkString(value, varName);
      if (!/^(?!.*\d)[A-Za-z\s'-.]{5,25}$/.test(name)) {
        throw `Name must be 2-20 alphabetic characters with no spaces or numbers`;
      }
      return name;

    }

    case 'username': {
      let userId = checkString(value, 'username');
      if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{5,}$|^[A-Za-z]{5,}$/.test(userId)) {
        throw 'userId must contain 5 to 10 characters and must be only letters and integers';
      }
      return userId;
    }

    case 'password': {
      const pwd = checkString(value, 'password');
      if (pwd.includes(' ')) {
        throw 'Password must not contain spaces';
      }
      if (pwd.length < 8) {
        throw 'Password must be at least 8 characters long';
      }
      if (!/[A-Z]/.test(pwd)) {
        throw 'Password must contain >=  uppercase letter';
      }
      if (!/[0-9]/.test(pwd)) {
        throw 'Password must contain >=  number';
      }
      if (!/[!@#$%^&*(),.?":{}|<>[\]\\\/`~_\-+=;]/.test(pwd)) {
        throw 'Password must contain >= special character';

      }
      return pwd;


    }

    case 'body': {
      const varName = 'body';
      const name = checkString(value, varName);
      if (!/^.{10,}$/.test(name)) {
        throw `Body must be at least 10 characters`;
      }
      return name;


    }

    case 'title': {
      const varName = 'title';
      const name = checkString(value, varName);
      if (!/^.{10,255}$/.test(name)) {
        throw `Title must be 10-255 characters`;
      }
      return name;
    }

    case 'comment': {
      const varName = 'comment';
      const name = checkString(value, varName);
      if (!/^.{2,500}$/.test(name)) {
        throw `Comment must be 2-500 characters`;
      }
      return name;
    }

    default: {
      throw `Unknown type '${type}'`;
    }
  }
}};


export default exportedMethods;