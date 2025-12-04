const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

async function fetchLanguages() {
  const query = `
    query($username: String!) {
      user(login: $username) {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { username: GITHUB_USERNAME } }),
  });

  const data = await response.json();
  
  if (data.errors) {
    console.error('GraphQL errors:', data.errors);
    throw new Error('Failed to fetch language data');
  }

  return data.data.user.repositories.nodes;
}

function aggregateLanguages(repos) {
  const languages = {};
  
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      const size = edge.size;
      languages[name] = (languages[name] || 0) + size;
    }
  }

  // Sort by size and get top 8
  const sorted = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const total = sorted.reduce((sum, [, size]) => sum + size, 0);
  
  return sorted.map(([name, size]) => ({
    name,
    size,
    percentage: ((size / total) * 100).toFixed(1),
  }));
}

function generateSVG(languages) {
  const width = 400;
  const barHeight = 28;
  const barGap = 8;
  const padding = 20;
  const barStartX = 140;
  const barWidth = width - barStartX - padding;
  const height = padding * 2 + languages.length * (barHeight + barGap) - barGap;

  const bars = languages.map((lang, i) => {
    const y = padding + i * (barHeight + barGap);
    const fillWidth = (parseFloat(lang.percentage) / 100) * barWidth;
    
    return `
    <g>
      <text x="${barStartX - 10}" y="${y + barHeight / 2 + 5}" 
            font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" 
            font-size="13" 
            fill="#e6e6e6" 
            text-anchor="end">${lang.name}</text>
      <rect x="${barStartX}" y="${y}" width="${barWidth}" height="${barHeight}" 
            fill="#1a1a1a" rx="4"/>
      <rect x="${barStartX}" y="${y}" width="${fillWidth}" height="${barHeight}" 
            fill="#ffffff" rx="4"/>
      <text x="${barStartX + barWidth + 8}" y="${y + barHeight / 2 + 5}" 
            font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace" 
            font-size="11" 
            fill="#808080">${lang.percentage}%</text>
    </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 50}" height="${height}" viewBox="0 0 ${width + 50} ${height}">
  <rect width="100%" height="100%" fill="#0d0d0d" rx="8"/>
  ${bars}
</svg>`;
}

async function main() {
  try {
    console.log('Fetching language data...');
    const repos = await fetchLanguages();
    
    console.log('Aggregating languages...');
    const languages = aggregateLanguages(repos);
    
    console.log('Top languages:', languages);
    
    console.log('Generating SVG...');
    const svg = generateSVG(languages);
    
    // Ensure assets directory exists
    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    
    // Write SVG file
    const svgPath = path.join(assetsDir, 'languages.svg');
    fs.writeFileSync(svgPath, svg);
    
    console.log(`SVG written to ${svgPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
