/* 
  File: app.js 
  Author: Benjamin
  Purpose: Handles OpenWeatherMap API calls and UI updates
  Version: 1.0
*/

/* ---------------- Config & State ---------------- */
const apiKey = "43c508a19070817388b32d93b5569939";

let currentUnit = "metric"; // metric = °C, imperial = °F
let loading = false;
let sidebarLoading = false;


const popularCities = [
  "Bangkok", "Berlin", "Cairo", "Delhi", "London",
  "Madrid", "New York", "Paris", "Rio de Janeiro",
  "Shanghai", "Sydney", "Tokyo"
].sort();

/* ---------------- DOM Refs ---------------- */
const cityInput = () => document.getElementById("cityInput");
const searchBtn = () => document.getElementById("searchBtn");
const unitToggle = () => document.getElementById("unitToggle");
const weatherResult = () => document.getElementById("weatherResult");
const forecastResult = () => document.getElementById("forecastResult");
const sidebar = () => document.getElementById("cityList");
const bgOverlay = () => document.getElementById("bg-overlay");
const particlesRoot = () => document.getElementById("particles");

/* ---------------- Initialization ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Search button
  searchBtn().addEventListener("click", () => {
    const c = cityInput().value.trim();
    if (!c) {
      alert("Please enter a city name.");
      return;
    }
    getWeather(c);
  });

  // Celsius/Fahrenheit toggle
  unitToggle().addEventListener("click", () => {
    currentUnit = currentUnit === "metric" ? "imperial" : "metric";
    const cityTitle = document.querySelector("#weatherResult h2");
    if (cityTitle && cityTitle.textContent) getWeather(cityTitle.textContent);
    buildCitySidebar();
  });

  // Try geolocation on load
  if (navigator.geolocation) {
    weatherResult().innerHTML = "<p>Detecting your location...</p>";
    navigator.geolocation.getCurrentPosition(
      pos => getWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      err => {
        console.warn("Geolocation error:", err);
        weatherResult().innerHTML = "<p>Location detection failed. Please search manually.</p>";
      }
    );
  } else {
    weatherResult().innerHTML = "<p>Geolocation not supported by your browser.</p>";
  }

  // Build sidebar once
  buildCitySidebar();
});

/* ---------------- Sidebar ---------------- */
async function buildCitySidebar() {
  const side = sidebar();
  if (!side) return;
  side.innerHTML = "<h3>Popular Cities</h3>";

  // Fetch all in parallel for faster loading
  const cityRequests = popularCities.map(city =>
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${currentUnit}`)
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
  );

  const results = await Promise.all(cityRequests);

  results.forEach((data, index) => {
    const city = popularCities[index];
    const item = document.createElement("div");
    item.className = "city-item";

    if (data && data.main) {
      const temp = Math.round(data.main.temp);
      item.innerHTML = `<span>${city}</span><span>${temp}°${currentUnit === "metric" ? "C" : "F"}</span>`;
    } else {
      item.innerHTML = `<span>${city}</span><span>N/A</span>`;
    }

    item.addEventListener("click", () => getWeather(city));
    side.appendChild(item);
  });
}

/* ---------------- Fetch Helpers ---------------- */
async function getWeather(city) {
  if (loading) return;
  loading = true;
  weatherResult().innerHTML = "<p>Loading...</p>";
  forecastResult().innerHTML = "";

  const weatherURL = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${currentUnit}`;
  const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${currentUnit}`;

  try {
    const [wRes, fRes] = await Promise.all([fetch(weatherURL), fetch(forecastURL)]);
    if (!wRes.ok) throw new Error("City not found");
    const weatherData = await wRes.json();
    const forecastData = await fRes.json();
    displayCurrentWeather(weatherData);
    displayForecast(forecastData);
  } catch (err) {
    weatherResult().innerHTML = `<p>${err.message}</p>`;
    forecastResult().innerHTML = "";
    console.error(err);
  } finally {
    loading = false;
  }
}

async function getWeatherByCoords(lat, lon) {
  if (loading) return;
  loading = true;
  weatherResult().innerHTML = "<p>Loading location weather...</p>";
  forecastResult().innerHTML = "";

  const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;
  const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;

  try {
    const [wRes, fRes] = await Promise.all([fetch(weatherURL), fetch(forecastURL)]);
    if (!wRes.ok) throw new Error("Unable to retrieve location data.");
    const weatherData = await wRes.json();
    const forecastData = await fRes.json();
    displayCurrentWeather(weatherData);
    displayForecast(forecastData);
  } catch (err) {
    weatherResult().innerHTML = `<p>${err.message}</p>`;
    console.error(err);
  } finally {
    loading = false;
  }
}

/* ---------------- UI Rendering ---------------- */
function displayCurrentWeather(data) {
  const { name, main, weather, wind } = data;
  const icon = `https://openweathermap.org/img/wn/${weather[0].icon}@2x.png`;
  const tempUnit = currentUnit === "metric" ? "C" : "F";
  const windUnit = currentUnit === "metric" ? "m/s" : "mph";

  weatherResult().innerHTML = `
    <h2>${name}</h2>
    <img src="${icon}" alt="${weather[0].description}">
    <p style="opacity:0.9">${weather[0].description}</p>
    <p>Temperature: ${round(main.temp)} °${tempUnit}</p>
    <p>Humidity: ${main.humidity}%</p>
    <p>Wind: ${wind.speed} ${windUnit}</p>
  `;

  updateBackground(weather[0].main.toLowerCase(), data);
}

function displayForecast(data) {
  const container = forecastResult();
  container.innerHTML = "<h3>5-Day Forecast</h3><div class='forecast-container' id='fc-list'></div>";
  const listRoot = document.getElementById("fc-list");

  let dailyData = data.list.filter(item => item.dt_txt.includes("12:00:00"));
  if (dailyData.length < 5) dailyData = data.list.filter((_, i) => i % 8 === 0).slice(0, 5);

  dailyData.slice(0, 5).forEach(day => {
    const dateObj = new Date(day.dt_txt);
    const date = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;
    const icon = `https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png`;
    const temp = round(day.main.temp);
    const unit = currentUnit === "metric" ? "C" : "F";

    const card = document.createElement("div");
    card.className = "forecast-day";
    card.innerHTML = `
      <div style="font-size:13px;opacity:0.9">${date}</div>
      <img src="${icon}" alt="${day.weather[0].description}">
      <div style="margin-top:6px;font-weight:600">${temp} °${unit}</div>
    `;
    listRoot.appendChild(card);
  });
}

/* ---------------- Background & Particles ---------------- */
function updateBackground(condition, weatherObj = null) {
  let className = "night";
  if (condition.includes("rain") || condition.includes("drizzle") || condition.includes("thunder")) className = "rainy";
  else if (condition.includes("snow")) className = "snowy";
  else if (condition.includes("cloud")) className = "cloudy";
  else if (condition.includes("wind")) className = "windy";
  else if (condition.includes("clear")) className = "sunny";

  const overlay = bgOverlay();
  overlay.className = "";
  overlay.classList.add(className);

  const root = particlesRoot();
  root.innerHTML = "";

  if (className === "rainy") createParticles("rain-drop", 60);
  if (className === "snowy") createParticles("snow-flake", 40);

  if (weatherObj && weatherObj.sys) {
    const now = Date.now() / 1000;
    overlay.style.opacity = now < weatherObj.sys.sunrise || now > weatherObj.sys.sunset ? "0.95" : "1";
  } else {
    overlay.style.opacity = "1";
  }
}

/* ---------------- Particles ---------------- */
function createParticles(type, count) {
  const root = particlesRoot();
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = type;
    const left = Math.random() * vw;
    el.style.left = left + "px";
    const dur = type === "rain-drop" ? 0.9 + Math.random() * 1.6 : 2 + Math.random() * 3;
    el.style.animationDuration = `${dur}s`;
    el.style.animationDelay = `${Math.random() * 1.2}s`;
    root.appendChild(el);
  }
}

/* ---------------- Utility ---------------- */
function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}