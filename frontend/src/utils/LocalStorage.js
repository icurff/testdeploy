const accessToken = {};
accessToken.KEY = "Token";
accessToken.addAccessToken = (token) => {
  localStorage.setItem(accessToken.KEY, token);
};
accessToken.getAccessToken = () => {
  return localStorage.getItem(accessToken.KEY);
};
accessToken.removeAccessToken = () => {
  localStorage.removeItem(accessToken.KEY);
};

export default accessToken;
