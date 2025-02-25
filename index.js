const video = document.getElementById('youtube-video');
const fallbackImage = document.querySelector('.fallback-image');

// Handle video errors
video.addEventListener('error', () => {
    video.style.display = 'none';
    fallbackImage.style.display = 'block';
});

// Mobile detection and fallback
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

if (isMobile()) {
    video.style.display = 'none';
    fallbackImage.style.display = 'block';
}

// Add this to your existing scroll event listener
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    // Keep your existing scroll logic
    // Add parallax effect to video background
    if (!isMobile()) {
        const scrolled = window.pageYOffset;
        video.style.transform = `translate(-50%, ${-50 + (scrolled * 0.1)}%)`;
    }
});
        // Enhanced Mobile Menu Toggle
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const mobileCloseBtn = document.querySelector('.mobile-close-btn');
        const nav = document.querySelector('nav');
        const navLinks = document.querySelectorAll('.nav-links > li');
        const mobileOverlay = document.querySelector('.mobile-overlay');

        function closeMenu() {
            nav.classList.remove('active');
            mobileOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }

        function openMenu() {
            nav.classList.add('active');
            mobileOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        mobileMenuBtn.addEventListener('click', openMenu);
        mobileCloseBtn.addEventListener('click', closeMenu);
        mobileOverlay.addEventListener('click', closeMenu);

        // Enhanced Mobile Dropdown Toggle
        navLinks.forEach(link => {
            const dropdown = link.querySelector('.dropdown');
            if (dropdown) {
                link.addEventListener('click', (e) => {
                    if (window.innerWidth <= 1024) {
                        e.preventDefault();
                        dropdown.classList.toggle('active');
                        
                        // Close other dropdowns
                        navLinks.forEach(otherLink => {
                            if (otherLink !== link) {
                                const otherDropdown = otherLink.querySelector('.dropdown');
                                if (otherDropdown) {
                                    otherDropdown.classList.remove('active');
                                }
                            }
                        });
                    }
                });
            }
        });

        // Enhanced Login Modal
        const loginBtn = document.querySelector('.login-btn');
        const modal = document.querySelector('.modal');
        const closeModal = document.querySelector('.close-modal');

        loginBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
        });

        function closeModalHandler() {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }

        closeModal.addEventListener('click', closeModalHandler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalHandler();
            }
        });

        // Enhanced Header Scroll Effect
        window.addEventListener('scroll', () => {
            const header = document.querySelector('header');
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-links')) {
                const dropdowns = document.querySelectorAll('.dropdown');
                dropdowns.forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
        // YouTube Video Background
var player;
var startTime = 30; // Start at 30 seconds
var endTime = 90;   // End at 1 minute 30 seconds

// Load YouTube API
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
  player = new YT.Player('youtube-video', {
    videoId: 'eoTKXtrRjmY', // Replace with your YouTube ID
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 0,
      start: startTime,
      modestbranding: 1,
      playsinline: 1,
      rel: 0
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  event.target.playVideo();
}

function onPlayerStateChange(event) {
  if (event.data == YT.PlayerState.PLAYING) {
    var interval = setInterval(function() {
      var currentTime = player.getCurrentTime();
      if (currentTime >= endTime) {
        player.seekTo(startTime);
        player.playVideo();
      }
    }, 1000);
  }
}
// Check if mobile and pause video
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

if (isMobile()) {
  const videoContainer = document.querySelector('.youtube-video');
  if (videoContainer) {
    videoContainer.style.display = 'none';
  }
}