
function setCookie(res, cookieName, cookieValue) {
  res.cookie(cookieName, cookieValue, {
    maxAge: Number(process.env.EXPRESS_SESSION_TIMEOUT_MS),
    httpOnly: true,
    secure: true,
  });
}

function getCookie(cookieName,req) {
  try {
    
    return req?.cookies[cookieName];

  } catch (error) {
    console.log('Get cookie:', error);
  }

  return '';
}

exports.setCookie = setCookie;
exports.getCookie = getCookie;