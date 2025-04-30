module.exports = {
    firstUpper: (name) => {
        const formattedName = name.toLowerCase();
        return formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
    },

    lowerCase: (str) => {
        return str.toLowerCase();
    },

    upperCase: (str) => {
        return str.toUpperCase();
    }
}