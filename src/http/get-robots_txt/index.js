const robots = `User-agent: *
Allow: /`;

exports.handler = async function http() {
  return {
    headers: {
      'Content-Type': 'text/plain; charset=utf8',
      'Cache-Control': 'public, max-age=31536000',
    },
    body: robots,
  };
};
