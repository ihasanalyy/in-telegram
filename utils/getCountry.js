module.exports = {
  getCountryName: (code) => {
    if (code === '+263') {
      return 'Zimbabwe';
    } else if (code === '+234') {
      return 'Nigeria';
    } else if (code === '+44') {
      return 'United Kingdom';
    } else if (code === '+1') {
      return 'United State';
    }
  },
};
