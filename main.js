// main.js

// 1. Import all modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    addDoc,
    updateDoc,
    query,
    where,
    getDocs,
    setDoc,
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { loadStripe } from 'https://cdn.jsdelivr.net/npm/@stripe/stripe-js@1.54.1/dist/stripe.esm.js';

// 2. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAkT263nxI1qdMvgcZqS2M37-C4OwYL2I0",
    authDomain: "kenya-on-a-budget-safaris.firebaseapp.com",
    projectId: "kenya-on-a-budget-safaris",
    storageBucket: "kenya-on-a-budget-safaris.firebasestorage.app",
    messagingSenderId: "857055399633",
    appId: "1:857055399633:web:8531f564a3ffc3d0f1bff0"
  };

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 4. Booking Status Functions
async function checkBookingStatus(userId) {
    try {
        const bookingRef = doc(db, 'bookings', userId);
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            showExistingBooking(docSnap.data());
        } else {
            showNewUserView();
        }
    } catch (error) {
        console.error('Error checking booking status:', error);
        showNewUserView();
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

async function showExistingBooking(bookingData) {
    document.getElementById('existingBookingView').style.display = 'block';
    document.getElementById('newUserView').style.display = 'none';
    
    // Fill in booking data
    document.getElementById('packageName').textContent = bookingData.packageName;
    document.getElementById('packageDuration').textContent = bookingData.duration;
    document.getElementById('packageCost').textContent = `£${bookingData.cost}`;

    // Guide info
    document.getElementById('guideName').textContent = bookingData.guide.name;
    document.getElementById('guideExperience').textContent = bookingData.guide.experience;
    document.getElementById('guideLanguages').textContent = bookingData.guide.languages.join(', ');

    // Dates
    document.getElementById('arrivalDate').textContent = bookingData.dates.arrival.date;
    document.getElementById('arrivalTime').textContent = bookingData.dates.arrival.time;
    document.getElementById('departureDate').textContent = bookingData.dates.departure.date;
    document.getElementById('departureTime').textContent = bookingData.dates.departure.time;

    // Payment
    document.getElementById('totalCost').textContent = `£${bookingData.paymentStatus.totalAmount}`;
    document.getElementById('paidAmount').textContent = `£${bookingData.paymentStatus.paidAmount}`;
    document.getElementById('remainingBalance').textContent = `£${bookingData.paymentStatus.remainingBalance}`;
    //document.getElementById('paymentStatus').textContent = bookingData.paymentStatus.depositStatus;

    // Start countdown if arrival date exists
    if (bookingData.dates?.arrival?.date) {
        updateCountdown(bookingData.dates.arrival.date);
    }

    // Load guide image
    if (bookingData.guide?.imageUrl) {
        try {
            const imageRef = ref(storage, bookingData.guide.imageUrl);
            const imageUrl = await getDownloadURL(imageRef);
            document.getElementById('guideImage').src = imageUrl;
        } catch (error) {
            console.error('Error loading guide image:', error);
            document.getElementById('guideImage').src = 'caro2.jpg';
        }
    }
    if (bookingData.itinerary && bookingData.itinerary.length > 0) {
        const itineraryContainer = document.querySelector('.itinerary-grid');
        if (itineraryContainer) {
            itineraryContainer.innerHTML = ''; // Clear existing content
            
            bookingData.itinerary.forEach(day => {
                const dayCard = document.createElement('div');
                dayCard.className = 'itinerary-card';
                dayCard.innerHTML = `
                    <div class="day-header">
                        <span class="day-number">Day ${day.day}</span>
                        <span class="day-date">${day.date}</span>
                    </div>
                    <div class="itinerary-content">
                        <h3>${day.title}</h3>
                        <div class="timeline">
                            ${day.activities.map(activity => `
                                <div class="timeline-item">
                                    <span class="time">${activity.time}</span>
                                    <p>${activity.description}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                itineraryContainer.appendChild(dayCard);
            });
        }
    }

    
}

function showNewUserView() {
    document.getElementById('newUserView').style.display = 'block';
    document.getElementById('existingBookingView').style.display = 'none';
}
let selectedDate = null;
let selectedTime = null;

// Function to show modal
let globalBookingDetails = null;

// Date Modal Functionality
function showDateModal(packageId, amount, packageName) {
    const modal = document.getElementById('dateModal');
    const dateInput = document.getElementById('arrivalDate');
    
    // Store booking details globally
    globalBookingDetails = { packageId, amount, packageName };
    
    // Set minimum date to today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    dateInput.min = minDate;

    // Default to one week from today
    const oneWeek = new Date(today);
    oneWeek.setDate(oneWeek.getDate() + 7);
    const defaultDate = oneWeek.toISOString().split('T')[0];
    dateInput.value = defaultDate;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideDateModal() {
    const modal = document.getElementById('dateModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}
async function processBooking(bookingData) {
    
    try {
        const user = auth.currentUser;
        const stripe = await loadStripe('pk_live_51Qkmzw2M6NX3wDsRNaEGe8kjVBjy7HurG5huwDIrnnusk2VaMxGCYwtjel9MdYxkM3RH9deLSR9zWW7ZeZ0S4hd600Zt3gHnCb');

        // Create temporary booking
        const tempBookingsRef = collection(db, 'tempBookings');
        const tempBookingDoc = await addDoc(tempBookingsRef, bookingData);

        // Create checkout session
        const response = await fetch('https://mylove-q4ru.onrender.com/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                packageId: bookingData.packageId,
                userId: user.uid,
                amount: bookingData.cost,
                tempBookingId: tempBookingDoc.id
            }),
        });

        if (!response.ok) {
            await deleteDoc(tempBookingDoc);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const session = await response.json();

        // Update temp booking with session ID
        await updateDoc(tempBookingDoc, {
            sessionId: session.id,
            lastUpdated: new Date()
        });

        // Redirect to Stripe checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            await deleteDoc(tempBookingDoc);
            throw new Error(result.error.message);
        }
    } catch (error) {
        console.error('Error processing booking:', error);
        alert('Error processing booking. Please try again.');
        throw error;
    }
}
// Function to validate and process the date selection
function handleDateSubmission(e) {
    e.preventDefault();
    
    const arrivalDate = document.getElementById('arrivalDate').value;
    const arrivalTime = document.getElementById('arrivalTime').value;
    
    // Validate that selected date is in the future
    const selectedDateTime = new Date(`${arrivalDate}T${arrivalTime}`);
    const now = new Date();
    
    if (selectedDateTime <= now) {
        alert('Please select a future date and time');
        return;
    }
    
    // Store the selected date and time
    selectedDate = arrivalDate;
    selectedTime = arrivalTime;
    
    // Format the departure date (7 days after arrival)
    const departureDate = new Date(selectedDateTime);
    departureDate.setDate(departureDate.getDate() + 7);
    
    // Update booking data
    const bookingData = {
        dates: {
            arrival: {
                date: selectedDateTime.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                }),
                time: selectedTime
            },
            departure: {
                date: departureDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                }),
                time: "11:00" // Default checkout time
            }
        }
    };
    
    // Hide the modal
    hideDateModal();
    
    // Proceed with the booking process
    return bookingData;
}
let selectedDateData = null;
// 5. Booking Package Function
window.bookPackage = async function(packageId, amount, packageName) {
    const packageItineraries = {
        'saver': {
            duration: "7 days 6 nights",
            itinerary: [
                {
                    day: 1,
                    date: "Day 1",
                    title: "Arrival in Nairobi",
                    activities: [
                        { time: "Arrival: ", description: "Guests arrive at Jomo Kenyatta International Airport and are welcomed by their assigned guide." },
                        { time: "Check-in: ", description: "Transfer via local transport (Uber or Matatu) to an affordable, comfortable BnB in Nairobi or an audited homestay." },
                        { time: "Activity: ", description: "Relax and acclimate. Optional evening walk to a nearby market for local crafts and souvenirs." },
                        { time: "Dinner: ", description: "Authentic Kenyan meal at a local eatery or with the host family." },
                    ]
                },
                {
                    day: 2,
                    date: "Day 2",
                    title: "Nairobi Exploration",
                    activities: [
                        { time: "Morning", description: "Visit the David Sheldrick Wildlife Trust to see baby elephants being cared for" },
                        { time: "Midday: ", description: "Lunch at a budget-friendly café serving Kenyan delicacies." },
                        { time: "Afternoon: ", description: "Head to the Giraffe Centre to interact with endangered Rothschild giraffes." },
                        { time: "Evening: ", description: "Experience a bustling local market, such as Maasai Market (days vary), for a true taste of Kenyan culture." }
                    ]
                },
                {
                    day: 3,
                    date: "Day 3",
                    title: "Journey to Ololokwe in Laikipia",
                    activities: [
                        { time: "Morning", description: "Travel via public bus or private matatu to Laikipia." },
                        { time: "Afternoon: ", description: "Arrival and check-in at a simple yet scenic BnB or audited homestay near Ololokwe." },
                        { time: "Afternoon: ", description: " Guided hike up Ololokwe, a sacred mountain offering breathtaking views." },
                        { time: "Evening: ", description: "Relax with locals over a casual dinner." }
                    ]
                },
                {
                    day: 4,
                    date: "Day 4",
                    title: " Cultural Day",
                    activities: [
                        { time: "Morning", description: "Spend time with a local community to learn traditional skills like beadwork or farming techniques." },
                        { time: "Afternoon: ", description: " Participate in a barbecue night with locals, featuring Nyama Choma (grilled meat), chapati, and other Kenyan favorites." },
                       
                        { time: "Evening: ", description: "Storytelling session by the fire." }
                    ]
                },
                {
                    day: 5,
                    date: "Day 5",
                    title: "The Great Maasai Mara",
                    activities: [
                        { time: "Morning", description: "Travel via local transport to Maasai Mara. Check in to a budget-friendly tented camp." },
                        { time: "Afternoon: ", description: "Guided game drive to witness the Big Five and other wildlife." },
                        
                        { time: "Evening: ", description: "Enjoy a simple meal while soaking in the Mara's tranquility." }
                    ]
                },
                {
                    day: 6,
                    date: "Day 6",
                    title: "Maasai Mara & Return to Nairobi",
                    activities: [
                        { time: "Morning", description: "Sunrise game drive followed by breakfast." },
                        { time: "Midday: ", description: "Visit a Maasai village to learn about their traditions and buy handmade souvenirs." },
                        { time: "Afternoon: ", description: "Return to Nairobi using local transport." },
                        { time: "Evening: ", description: "Rest or optional night tour of Nairobi city." }
                    ]
                },
                {
                    day: 7,
                    date: "Day 7",
                    title: " Farewell and Free Time",
                    activities: [
                        { time: "Morning", description: " Free time for last-minute shopping or a visit to Karura Forest for a nature walk." },
                        
                        { time: "Afternoon: ", description: "Pack and prepare for departure." },
                        { time: "Evening: ", description: "Airport transfer for their journey home. GOOD BYE BUT NOT FOREVER 👋🏿" }
                    ]
                },
                // Add more days...
            ]
        },
        'standard': {
            duration: "7 days 6 nights",
            itinerary: [
                {
                    day: 1,
                    date: "Day 1",
                    title: "Arrival in Nairobi",
                    activities: [
                        { time: "Arrival: ", description: "Land at Jomo Kenyatta International Airport and meet your personal guide." },
                        { time: "Check-in: ", description: "Transfer to a comfortable hotel or BnB in Nairobi with breakfast included." },
                        { time: "Evening: ", description: "Relax and enjoy a local welcome dinner with scenic views at a rooftop or garden restaurant." },
                        
                    ]
                },
                {
                    day: 2,
                    date: "Day 2",
                    title: "Nairobi Wildlife & Culture",
                    activities: [
                        { time: "Morning", description: "Visit the David Sheldrick Wildlife Trust to see rescued baby elephants." },
                        
                        { time: "Afternoon: ", description: "Head to the Giraffe Centre for up-close interaction with endangered Rothschild giraffes." },
                        { time: "Evening: ", description: "Stroll through the Maasai Market to shop for authentic souvenirs and crafts." }
                    ]
                },
                {
                    day: 3,
                    date: "Day 3",
                    title: "Journey to Lake Naivasha",
                    activities: [
                        { time: "Morning", description: "Private transport to Lake Naivasha. Check-in at a standard lakeside hotel." },
                        { time: "Afternoon: ", description: "Enjoy an optional boat ride to see hippos and aquatic birds up close." },
                        
                        { time: "Evening: ", description: "Dinner with a serene lakeside view." }
                    ]
                },
                {
                    day: 4,
                    date: "Day 4",
                    title: " Safari in Maasai Mara",
                    activities: [
                        { time: "Morning", description: "Travel to the Maasai Mara in a comfortable private vehicle. Check-in at a budget-friendly lodge with modern amenities." },
                        { time: "Afternoon: ", description: " Embark on a thrilling guided game drive to spot the Big Five." },
                       
                        { time: "Evening: ", description: "Optional night safari or relax under the stars." }
                    ]
                },
                {
                    day: 5,
                    date: "Day 5",
                    title: "Cultural Immersion & Extended Safari",
                    activities: [
                        { time: "Morning", description: "Visit a Maasai village to learn about their traditions, dance, and beadwork." },
                        { time: "Afternoon: ", description: " Enjoy an extended safari, exploring deeper into the Mara." },
                        
                        { time: "Evening: ", description: "Savor a delicious Nyama Choma barbecue dinner while watching a cultural dance performance." }
                    ]
                },
                {
                    day: 6,
                    date: "Day 6",
                    title: "Return to Nairobi & Evening Activities",
                    activities: [
                        { time: "Morning", description: "Return to Nairobi, with a stop for a relaxing lunch en route." },
                       
                        { time: "Afternoon: ", description: " Free time for shopping or optional activities like a nature walk in Karura Forest" },
                        { time: "Evening: ", description: " Enjoy a farewell dinner with a live cultural music performance.." }
                    ]
                },
                {
                    day: 7,
                    date: "Day 7",
                    title: "Departure",
                    activities: [
                        { time: "Morning", description: "  Optional yoga or meditation session in a tranquil setting to conclude your trip." },
                        
                        { time: "Afternoon: ", description: "Pack and prepare for your airport transfer." },
                        { time: "Evening: ", description: "Airport transfer for their journey home. GOOD BYE BUT NOT FOREVER 👋🏿" }
                    ]
                },
                // Add more days...
            ]
        },
        'family': {
            duration: "9 days 8 nights",
            itinerary: [
                {
                    day: 1,
                    date: "Day 1",
                    title: "Arrival and Welcome to Kenya",
                    activities: [
                        { time: "Experience Begins: ", description: "Upon arrival at the airport, a dedicated guide will welcome you with warm Kenyan hospitality." },
                        { time: "Personal Touch: ", description: " A private transfer will take your family to a cozy BnB where a beautifully arranged food bouquet awaits to make you feel right at home." },
                        { time: "Relax & Unwind: ", description: "Take the evening to rest, recharge, and prepare for the adventure ahead." }
                       
                    ]
                },
                {
                    day: 2,
                    date: "Day 2",
                    title: "Wildlife Wonders & Family Fun",
                    activities: [
                        { time: "Morning Magic: ", description: "Kickstart your day at the Giraffe Centre, where you’ll hand-feed and interact with the majestic creatures in a serene environment." },
                        { time: "Lunch with a View: ", description: "Enjoy a delightful meal near the Nairobi National Park, surrounded by the sounds of nature." },
                        { time: "Educational Adventure: ", description: "Head to the Sheldrick Wildlife Trust to meet baby elephants, learn about their rescue stories, and witness conservation in action." },
                        { time: "Fun for All: ", description: "End the day at Two Rivers Mall, where the kids can enjoy carnival rides and activities. Meanwhile, parents can sneak away to a luxurious spa retreat, knowing the little ones are in good hands with a vetted nanny." }
                    ]
                },
                {
                    day: 3,
                    date: "Day 3",
                    title: "Thrills at Hells Gate and Naivasha Serenity",
                    activities: [
                        { time: "Bike Through Nature: ", description: "Cycle through the breathtaking landscapes of Hells Gate National Park, with stunning rock formations, wildlife sightings, and a guide van ready to assist if needed" },
                        { time: "Rejuvenate in Warm Waters: ", description: "After the thrill of biking, soak in the natural Olkaria Geothermal Spa, a one-of-a-kind experience." },
                        { time: "Afternoon: ", description: " Guided hike up Ololokwe, a sacred mountain offering breathtaking views." },
                        { time: "Sundowner on the Lake: ", description: "Cap off the day with a relaxing boat ride on Lake Naivasha, where you’ll spot playful hippos and enjoy the magical Kenyan sunset." }
                    ]
                },
                {
                    day: 4,
                    date: "Day 4",
                    title: "Immerse in Kenyan Culture",
                    activities: [
                        { time: "Authentic Connections: ", description: "Spend the day with local artisans and chefs, learning how to prepare Kenya’s most loved cuisines. Try your hand at crafting souvenirs with the guidance of talented locals." },
                        { time: "Evening Bonfire: ", description: " Gather around a traditional bonfire and enjoy an unforgettable Nyama Choma feast while swapping stories and soaking in Kenyan culture under the stars." }
                       
                
                    ]
                },
                {
                    day: 5,
                    date: "Day 5",
                    title: "The Ultimate Maasai Mara Safari",
                    activities: [
                        { time: "Journey to the Wild: ", description: "Take a scenic drive or train ride to the world-famous Maasai Mara, home to the Big Five and stunning savannah landscapes." },
                        { time: "Afternoon Game Drive: ", description: "Experience the thrill of spotting lions, elephants, and cheetahs on an expert-guided safari tour." },
                        
                        { time: "Under the Stars: ", description: "Spend the night in a luxury tented camp, surrounded by the sounds of the African wilderness." }
                    ]
                },
                {
                    day: 6,
                    date: "Day 6",
                    title: " Morning Safari & Coastal Charm",
                    activities: [
                        { time: "Sunrise Safari: ", description: "Start the day with a magical morning game drive as the savannah comes to life." },
                        { time: "Coastal Bound: ", description: "Enjoy breakfast before heading to Mombasa via flight or train." },
                        { time: "Dine by the Ocean: ", description: "End the day with a relaxing dinner overlooking the Indian Ocean, indulging in fresh seafood and coastal delicacies." }
                        
                    ]
                },
                {
                    day: 7,
                    date: "Day 7",
                    title: " Coastal Adventure",
                    activities: [
                        { time: "Marine Exploration: ", description: "Visit the beautiful Malindi or take an exciting trip to the Dolphin Marine Park to witness playful dolphins in their natural habitat." },
                        
                        { time: "Coastal Cuisine: ", description: "Savor exotic coastal dishes, blending African, Arabic, and Indian influences." }
                       
                    ]
                },
                {
                    day: 8,
                    date: "Day 8",
                    title: " : Rest and Return to Nairobi",
                    activities: [
                        { time: "Relax and Reflect: ", description: "Spend the morning unwinding on the beach or exploring Mombasa’s vibrant streets." },
                        
                        { time: "Journey Back: ", description: "Travel back to Nairobi via road, train, or flight." },
                        { time: "Farewell Dinner: ", description: "Wrap up your trip with a farewell dinner at a charming Nairobi restaurant." }
                    ]
                },
                {
                    day: 9,
                    date: "Day 9",
                    title: "  Farewell, Kenya!",
                    activities: [
                        //{ time: "Morning", description: " Free time for last-minute shopping or a visit to Karura Forest for a nature walk." },
                        
                       // { time: "Afternoon: ", description: "Pack and prepare for departure." },
                        { time: "Goodbye, but not Forever: ", description: "Transfer to the airport for your departure flight, taking home memories of Kenya’s incredible landscapes, wildlife, and warm hospitality. " }
                    ]
                },
                // Add more days...
            ]
        },
        'luxury': {
            duration: "7 days 6 nights",
            itinerary: [
                {
                    day: 1,
                    date: "Day 1",
                    title: "Arrival in Nairobi",
                    activities: [
                        { time: "VIP Welcome: ", description: "Guests are greeted at Jomo Kenyatta International Airport with champagne, a welcome kit (including premium Kenyan tea and handmade souvenirs), and a dedicated concierge." },
                        { time: "Activity:", description: " Private transfer to a 5-star city hotel. Enjoy an optional spa session or visit the Karen Blixen Museum for a personalized after-hours tour." },
                        { time: "Accommodation: ", description: "Palatial suite at Giraffe Manor or Hemingways Nairobi." },
                        //{ time: "Dinner: ", description: "Authentic Kenyan meal at a local eatery or with the host family." },
                    ]
                },
                {
                    day: 2,
                    date: "Day 2",
                    title: "Nairobi to Maasai Mara (Chartered Flight)",
                    activities: [
                        { time: "Morning", description: " Take a private chartered flight to the Maasai Mara, landing at an exclusive airstrip near your luxury lodge." },
                        
                        { time: "Afternoon: ", description: "Begin your safari with a private game drive in a fully outfitted 4x4 Land Cruiser. Sip on curated cocktails while spotting wildlife." },
                        { time: "Value Addition: ", description: "Private sundowner setup in the savannah with a Maasai guide to narrate local legends." },
                        { time: "Accommodation: ", description: "High-end safari lodge or tented camp, such as Angama Mara or Mahali Mzuri, offering panoramic Mara views." }
                    ]
                },
                {
                    day: 3,
                    date: "Day 3",
                    title: "Full-Day Maasai Mara Safari",
                    activities: [
                        { time: "Morning", description: "Start the day with an unforgettable hot air balloon safari over the Mara, followed by a champagne breakfast in the bush." },
                        { time: "Afternoon: ", description: " Exclusive guided safari with a professional wildlife photographer for personalized tips and photo opportunities." },
                        { time: "Afternoon: ", description: "Private cultural interaction with Maasai elders and a traditional dance performance at the lodge." },
                        { time: "Accommodation: ", description: "Same luxurious camp/lodge as Day 2." }
                    ]
                },
                {
                    day: 4,
                    date: "Day 4",
                    title: " Maasai Mara to Amboseli (Flight)",
                    activities: [
                        { time: "Morning", description: "Fly directly to Amboseli National Park on a private charter. Enjoy an aerial view of Mount Kilimanjaro during the journey." },
                        { time: "Afternoon: ", description: " Arrive at your lodge, where you’ll be treated to a refreshing welcome drink and a light gourmet lunch." },
                       
                        { time: "Evening: ", description: "Embark on a golden hour game drive to see Amboseli’s iconic elephant herds and other wildlife." },
                        { time: "Accommodation: ", description: "Stay at a luxury eco-lodge such as Tawi Lodge or Amboseli Serena Safari Lodge, offering unparalleled views of Kilimanjaro." }
                    ]
                },
                {
                    day: 5,
                    date: "Day 5",
                    title: "Full-Day Amboseli Exploration",
                    activities: [
                        { time: "Morning", description: "Guided walking safari led by expert naturalists, offering a closer connection to Amboseli’s flora and fauna." },
                        { time: "Afternoon: ", description: "Relax at the lodge with a private poolside massage or yoga session." },
                        
                        { time: "Value Addition: ", description: "Exclusive behind-the-scenes tour with conservationists working to protect Amboseli’s elephants." },
                        { time: "Accommodation: ", description: "Same as Day 4." }
                    ]
                },
                {
                    day: 6,
                    date: "Day 6",
                    title: "Amboseli to Nairobi & Lake Naivasha",
                    activities: [
                        { time: "Morning", description: "Fly back to Nairobi for a gourmet brunch, then travel via private luxury vehicle to Lake Naivasha. Stop en route for curated wine tasting at a premium Kenyan vineyard." },
                       
                        { time: "Afternoon: ", description: "Arrive at a private lakeside retreat for an afternoon of relaxation." },
                       
                        { time: "Evening: ", description: "Enjoy a sunset boat ride to see hippos and exotic birdlife." },
                        { time: "Accommodation: ", description: "Stay at a high-end lodge, such as Loldia House, overlooking Lake Naivasha." },
                    ]
                },
                {
                    day: 7,
                    date: "Day 7",
                    title: " Departure",
                    activities: [
                        { time: "Morning", description: "Return to Nairobi for a farewell shopping spree at high-end Kenyan artisan boutiques (e.g., Kazuri Beads or Matbronze)." },
                        
                        { time: "Afternoon: ", description: "Guests enjoy a farewell lunch at the iconic Carnivore Restaurant or Tamarind Nairobi." },
                        { time: "Evening: ", description: "Private airport transfer with VIP lounge access before departure." }
                    ]
                },
                // Add more days...
            ]
        },
        'premium': {
            duration: "7 days 6 nights",
            itinerary: [
                {
                    day: 1,
                    date: "Day 1",
                    title: "Arrival in Nairobi",
                    activities: [
                        { time: "Welcome Experience: ", description: "Upon arrival, enjoy a personalized meet-and-greet service. Guests receive a welcome kit with Kenyan snacks, a local SIM card, and a small souvenir." },
                        { time: "Activity: ", description: "Depending on arrival time, visit the Karen Blixen Museum or the Giraffe Centre." },
                        { time: "Accommodation: ", description: "Luxury boutique hotel in Nairobi with a fine dining dinner." },
                    
                    ]
                },
                {
                    day: 2,
                    date: "Day 2",
                    title: "Nairobi to Maasai Mara",
                    activities: [
                        { time: "Morning", description: "Depart for the Maasai Mara in a private 4x4 vehicle, stopping for scenic views of the Great Rift Valley." },
                        { time: "Afternoon: ", description: "Arrive at your luxury tented camp in time for lunch." },
                        
                        { time: "Evening: ", description: "Embark on a guided sunset game drive, spotting the Big Five in Kenya’s premier wildlife reserve." },
                        { time: "Value Addition: ", description: "Extended safari hours at no extra charge." },
                        { time: "Accomodation: ", description: ": Luxurious Maasai Mara camp with private terraces overlooking the savannah." },
                    ]
                },
                {
                    day: 3,
                    date: "Day 3",
                    title: "Full-Day Maasai Mara Safari",
                    activities: [
                        { time: "Morning & Afternoon: ", description: "Full-day game drives to witness wildlife, including cheetahs, lions, and elephants. Visit the Mara River for a chance to see crocodiles and hippos." },
                        { time: "Value Addition", description: "Enjoy a cultural tour of a Maasai village with traditional dances and the opportunity to participate in beadwork crafting." },
                        { time: "Optional:", description: " Upgrade to a hot air balloon safari for breathtaking aerial views of the Mara." },
                        { time: "Accommodation: ", description: "Luxurious Maasai Mara camp." }
                    ]
                },
                {
                    day: 4,
                    date: "Day 4",
                    title: " Maasai Mara to Lake Nakuru",
                    activities: [
                        { time: "Morning", description: "Drive to Lake Nakuru National Park, renowned for its flamingos and rhinos" },
                        { time: "Afternoon: ", description: "Check into your luxury lodge and enjoy a gourmet lunch before heading out for a game drive. Spot endangered species such as the Rothschild giraffe and white rhinos." },
                       
                        { time: "Evening: ", description: "Relax with a complimentary spa treatment." },
                        { time: "Accommodation:", description: " Eco-lodge near Lake Nakuru with stunning lake views." }
                    ]
                },
                {
                    day: 5,
                    date: "Day 5",
                    title: "Lake Nakuru to Amboseli National Park",
                    activities: [
                        { time: "Morning", description: "Travel to Amboseli National Park, famed for its elephant herds and iconic views of Mount Kilimanjaro." },
                        { time: "Afternoon: ", description: "After checking in, enjoy a leisurely afternoon game drive." },
                        
                        { time: "Value Addition: ", description: "Exclusive photo session with a professional photographer." },
                        { time: "Accommodation:  ", description: "High-end lodge with panoramic views of Kilimanjaro." }
                    ]
                },
                {
                    day: 6,
                    date: "Day 6",
                    title: "Full-Day Amboseli Safari",
                    activities: [
                        { time: "Morning & Afternoon: ", description: "Explore Amboseli’s unique ecosystems, capturing elephants, flamingos, and zebras set against the backdrop of Africa’s tallest mountain." },
                        { time: "Optional: ", description: "Add a guided bushwalk or night safari for a rare wildlife experience." },
                        { time: "Evening: ", description: "Savor a cultural dinner with live traditional music." },
                        { time: "Accommodation: ", description: "Luxurious lodge in Amboseli." }
                    ]
                },
                {
                    day: 7,
                    date: "Day 7",
                    title: " Departure",
                    activities: [
                        { time: "Morning", description: "Return to Nairobi for a farewell lunch at a top-rated restaurant." },
                        
                        { time: "Optional: ", description: "Visit the David Sheldrick Elephant Orphanage before airport transfer." },
                        { time: "Farewell: ", description: "Guests are gifted a curated photo album with highlights of their journey." }
                    ]
                },
                // Add more days...
            ]
        },
        
        // Add other packages...
    };
    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Please login to book a package');
            return;
        }

        // Show the modal
        const modal = document.getElementById('dateModal');
        
        // Set minimum date to today
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Clear any existing form values
        document.getElementById('arrivalDate').value = '';
        document.getElementById('arrivalTime').value = '10:00';
        
        // Set the minimum date
        document.getElementById('arrivalDate').min = tomorrow.toISOString().split('T')[0];

        // Show modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Get the form element
        const dateForm = document.getElementById('travelDateForm');

        // Handle form submission
        dateForm.onsubmit = async (e) => {
            e.preventDefault();

            // Get form values directly from the form
            const formData = new FormData(e.target);
            const arrivalDateStr = formData.get('arrivalDate');
            const arrivalTimeStr = formData.get('arrivalTime');

            console.log('Raw form values:', {
                arrivalDate: arrivalDateStr,
                arrivalTime: arrivalTimeStr
            });

            if (!arrivalDateStr || !arrivalTimeStr) {
                alert('Please select both date and time');
                return;
            }

            // Create arrival date object
            const arrivalDate = new Date(arrivalDateStr + 'T' + arrivalTimeStr);
            console.log('Created arrival date:', arrivalDate.toString());

            // Validate future date
            if (arrivalDate <= new Date()) {
                alert('Please select a future date and time');
                return;
            }

            // Calculate departure date (7 days after arrival)
            const departureDate = new Date(arrivalDate);
            departureDate.setDate(departureDate.getDate() + 7);

            // Get package details
            const packageDetails = packageItineraries[packageId] || {
                duration: "7 days 6 nights",
                itinerary: []
            };

            // Create booking data
            const bookingData = {
                userId: user.uid,
                packageId: packageId,
                packageName: packageName,
                cost: amount,
                duration: packageDetails.duration,
                dates: {
                    arrival: {
                        date: arrivalDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        }),
                        time: arrivalTimeStr
                    },
                    departure: {
                        date: departureDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        }),
                        time: "11:00"
                    }
                },
                guide: {
                    name: "Caroline Wanjiku",
                    experience: "8 years",
                    languages: ["English", "Swahili"],
                    imageUrl: "gs://trial-17319.firebasestorage.app/caro2.jpg"
                },
                paymentStatus: {
                    status: "pending",
                    paidAmount: 0,
                    remainingBalance: amount,
                    totalAmount: amount
                },
                itinerary: packageDetails.itinerary,
                createdAt: new Date(),
                status: 'pending'
            };

            console.log('Final booking data:', JSON.stringify(bookingData, null, 2));

            try {
                // Hide modal
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';

                // Initialize Stripe
                const stripe = await loadStripe('pk_live_51Qkmzw2M6NX3wDsRNaEGe8kjVBjy7HurG5huwDIrnnusk2VaMxGCYwtjel9MdYxkM3RH9deLSR9zWW7ZeZ0S4hd600Zt3gHnCb');

                // Create temporary booking
                const tempBookingsRef = collection(db, 'tempBookings');
                const tempBookingDoc = await addDoc(tempBookingsRef, bookingData);

                // Create checkout session
                const response = await fetch('https://mylove-q4ru.onrender.com/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        packageId: packageId,
                        userId: user.uid,
                        amount: amount,
                        tempBookingId: tempBookingDoc.id
                    }),
                });

                if (!response.ok) {
                    await deleteDoc(tempBookingDoc);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const session = await response.json();

                // Update temp booking with session ID
                await updateDoc(tempBookingDoc, {
                    sessionId: session.id,
                    lastUpdated: new Date()
                });

                // Redirect to Stripe checkout
                const result = await stripe.redirectToCheckout({
                    sessionId: session.id
                });

                if (result.error) {
                    await deleteDoc(tempBookingDoc);
                    throw new Error(result.error.message);
                }

            } catch (error) {
                console.error('Error processing booking:', error);
                alert('Error processing booking. Please try again.');
            }
        };

    } catch (error) {
        console.error('Error details:', error);
        alert('Error booking package. Please try again. ' + error.message);
    }
};

// Event listeners for modal
document.addEventListener('DOMContentLoaded', function() {
    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const modal = document.getElementById('dateModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('dateModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
});
// Event listeners for modal
document.addEventListener('DOMContentLoaded', function() {
    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const modal = document.getElementById('dateModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('dateModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
});
// 6. Logout Function
window.logout = async function() {
    const logoutBtn = document.querySelector('.logout-btn');
    const spinner = document.getElementById('logoutSpinner');
    const linkText = document.querySelector('.logout-btn .link-text');
    
    try {
        logoutBtn.disabled = true;
        spinner.style.display = 'inline-block';
        linkText.textContent = 'Logging out...';
        
        await signOut(auth);
        window.location.href = 'before.html';
        
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Failed to logout. Please try again.');
        
        logoutBtn.disabled = false;
        spinner.style.display = 'none';
        linkText.textContent = 'Logout';
    }
};

// 7. Countdown Timer Function
function updateCountdown(arrivalDate) {
    const countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const arrival = new Date(arrivalDate).getTime();
        const timeLeft = arrival - now;

        if (timeLeft < 0) {
            clearInterval(countdownInterval);
            document.querySelectorAll('.countdown-value').forEach(el => {
                el.textContent = '00';
            });
            return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        updateValueWithAnimation('days', days.toString().padStart(2, '0'));
        updateValueWithAnimation('hours', hours.toString().padStart(2, '0'));
        updateValueWithAnimation('minutes', minutes.toString().padStart(2, '0'));
        updateValueWithAnimation('seconds', seconds.toString().padStart(2, '0'));
    }, 1000);
}

function updateValueWithAnimation(id, value) {
    const element = document.getElementById(id);
    if (element && element.textContent !== value) {
        element.classList.add('animate');
        element.textContent = value;
        setTimeout(() => {
            element.classList.remove('animate');
        }, 500);
    }
}

// 8. DOM Content Loaded Event Handler
document.addEventListener('DOMContentLoaded', function() {
    // Navigation setup
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = {
        'overview': document.querySelector('.overview-grid'),
        'itinerary': document.querySelector('.itinerary-section'),
        'payments': document.querySelector('.payments-section'),
        'support': document.querySelector('.support-section'),
        'pickup': document.querySelector('.pickup-section'),
        'accommodation': document.querySelector('.accommodation-section'),
        'upgrades': document.querySelector('.upgrades-section'),
        'settings': document.querySelector('.settings-section')
    };

    // Sidebar toggle
    const toggleBtn = document.querySelector('.toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    toggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('expanded');
            mainContent.classList.toggle('shrunk');
        } else {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        }
    });

    // Navigation handling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href').slice(1);
            
            Object.values(sections).forEach(section => {
                if (section) section.style.display = 'none';
            });
            
            if (sections[sectionId]) {
                sections[sectionId].style.display = 'block';
            }
            
            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            link.parentElement.classList.add('active');
        });
    });

    // Settings form
    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Settings saved successfully!');
        });
    }

    // Toggle switches
    document.querySelectorAll('.toggle-switch input').forEach(toggle => {
        toggle.addEventListener('change', function() {
            console.log('Preference updated:', this.checked);
        });
    });

    // FAQ toggles
    document.querySelectorAll('.faq-item').forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        }
    });

    // Upgrades filtering
    const priceFilter = document.getElementById('price-filter');
    const typeFilter = document.getElementById('activity-type');
    const upgradeCards = document.querySelectorAll('.upgrade-card');

    function filterUpgrades() {
        if (!priceFilter || !typeFilter) return;

        const selectedPrice = priceFilter.value;
        const selectedType = typeFilter.value;

        upgradeCards.forEach(card => {
            const priceCategory = card.dataset.price;
            const activityType = card.dataset.type;
            
            const priceMatch = selectedPrice === 'all' || priceCategory === selectedPrice;
            const typeMatch = selectedType === 'all' || activityType === selectedType;
            
            card.style.display = priceMatch && typeMatch ? 'block' : 'none';
        });
    }

    if (priceFilter && typeFilter) {
        priceFilter.addEventListener('change', filterUpgrades);
        typeFilter.addEventListener('change', filterUpgrades);
    }

    // Add to itinerary functionality
    document.querySelectorAll('.add-upgrade-btn').forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.upgrade-card');
            const activityName = card.querySelector('h3').textContent;
            const price = card.querySelector('.price-tag').textContent;
            alert(`Added ${activityName} (${price}) to your itinerary`);
        });
    });

    // Notifications and Messages Panel
    const setupNotificationsAndMessages = () => {
        const notificationLink = document.querySelector('a[href="#notifications"]');
        const messageLink = document.querySelector('a[href="#inbox"]');
        const notificationsPanel = document.querySelector('.notifications-panel');
        const messagesPanel = document.querySelector('.messages-panel');
        const notificationsBadge = document.querySelector('.notifications-badge');
        const messagesBadge = document.querySelector('.messages-badge');

        function togglePanel(panel, badge) {
            const isOpen = panel.style.display === 'block';
            
            notificationsPanel.style.display = 'none';
            messagesPanel.style.display = 'none';
            
            if (!isOpen) {
                panel.style.display = 'block';
                if (badge) badge.style.display = 'none';
            }
        }

        if (notificationLink) {
            notificationLink.addEventListener('click', (e) => {
                e.preventDefault();
                togglePanel(notificationsPanel, notificationsBadge);
            });
        }

        // Continuing from setupNotificationsAndMessages...
    
    if (messageLink) {
        messageLink.addEventListener('click', (e) => {
            e.preventDefault();
            togglePanel(messagesPanel, messagesBadge);
        });
    }

    // Close panels when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationsPanel && !notificationsPanel.contains(e.target) && 
            notificationLink && !notificationLink.contains(e.target)) {
            notificationsPanel.style.display = 'none';
        }
        if (messagesPanel && !messagesPanel.contains(e.target) && 
            messageLink && !messageLink.contains(e.target)) {
            messagesPanel.style.display = 'none';
        }
    });

    // Handle clear all buttons
    document.querySelectorAll('.clear-all').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = button.closest('.panel');
            const items = panel.querySelectorAll('.notification-item, .message-item');
            items.forEach(item => item.classList.remove('unread'));
        });
    });

    // Handle individual items
    document.querySelectorAll('.notification-item, .message-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.remove('unread');
        });
    });
};

    setupNotificationsAndMessages();

    // Room details functionality
    document.querySelectorAll('.details-btn').forEach(button => {
        button.addEventListener('click', () => {
            alert('Room details functionality coming soon!');
        });
    });
});
document.addEventListener('DOMContentLoaded', function() {
    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            const modal = document.getElementById('dateModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('dateModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
});


// 9. Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('userName').textContent = user.displayName || 'Guest';
        checkBookingStatus(user.uid);
        document.getElementById('userNamee').textContent = user.displayName || 'Guest';
        checkBookingStatus(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});
// Date Modal Functionality
// Add these functions to your JavaScript file

function showLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        startMessageRotation();
    }
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        stopMessageRotation();
    }
}

let messageInterval;

function startMessageRotation() {
    const messages = document.querySelectorAll('.message');
    let currentIndex = 0;
    
    // Show first message
    messages[0].classList.add('active');
    
    messageInterval = setInterval(() => {
        messages[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % messages.length;
        messages[currentIndex].classList.add('active');
    }, 3000); // Change message every 3 seconds
}

function stopMessageRotation() {
    if (messageInterval) {
        clearInterval(messageInterval);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const dateForm = document.getElementById('travelDateForm');
    if (dateForm) {
        dateForm.onsubmit = async (e) => {
            e.preventDefault();

            // Get form values
            const formData = new FormData(e.target);
            const arrivalDateStr = formData.get('arrivalDate');
            const arrivalTimeStr = formData.get('arrivalTime');

            if (!arrivalDateStr || !arrivalTimeStr) {
                alert('Please select both date and time');
                return;
            }

            // Create arrival date object
            const arrivalDate = new Date(arrivalDateStr + 'T' + arrivalTimeStr);

            // Validate future date
            if (arrivalDate <= new Date()) {
                alert('Please select a future date and time');
                return;
            }

            try {
                const user = auth.currentUser;
                if (!user) {
                    alert('Please login to book a package');
                    return;
                }

                // Hide modal and show loading
                const modal = document.getElementById('dateModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                showLoading();

                // Calculate departure date (7 days after arrival)
                const departureDate = new Date(arrivalDate);
                departureDate.setDate(departureDate.getDate() + 7);

                // Initialize Stripe
                const stripe = await loadStripe('pk_live_51Qkmzw2M6NX3wDsRNaEGe8kjVBjy7HurG5huwDIrnnusk2VaMxGCYwtjel9MdYxkM3RH9deLSR9zWW7ZeZ0S4hd600Zt3gHnCb');

                // Create temporary booking
                const tempBookingsRef = collection(db, 'tempBookings');
                const tempBookingDoc = await addDoc(tempBookingsRef, {
                    userId: user.uid,
                    dates: {
                        arrival: {
                            date: arrivalDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            }),
                            time: arrivalTimeStr
                        },
                        departure: {
                            date: departureDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            }),
                            time: "11:00"
                        }
                    },
                    guide: {
                        name: "Caroline Wanjiku",
                        experience: "8 years",
                        languages: ["English", "Swahili"],
                        imageUrl: "gs://trial-17319.firebasestorage.app/caro2.jpg"
                    },
                    packageId: globalBookingDetails.packageId,
                    packageName: globalBookingDetails.packageName,
                    cost: globalBookingDetails.amount,
                    createdAt: new Date()
                });

                // Create checkout session
                const response = await fetch('https://mylove-q4ru.onrender.com/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        packageId: globalBookingDetails.packageId,
                        userId: user.uid,
                        amount: globalBookingDetails.amount,
                        tempBookingId: tempBookingDoc.id
                    }),
                });

                if (!response.ok) {
                    await deleteDoc(tempBookingDoc);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const session = await response.json();

                // Update temp booking with session ID
                await updateDoc(tempBookingDoc, {
                    sessionId: session.id,
                    lastUpdated: new Date()
                });

                // Keep loading shown for at least 2 seconds for smooth transition
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Hide loading before redirect
                hideLoading();

                // Redirect to Stripe checkout
                const result = await stripe.redirectToCheckout({
                    sessionId: session.id
                });

                if (result.error) {
                    await deleteDoc(tempBookingDoc);
                    throw new Error(result.error.message);
                }

            } catch (error) {
                hideLoading();
                console.error('Error processing booking:', error);
                alert('Error processing booking. Please try again.');
            }
        };
    }
});
// Add this function to your main.js
function filterPaymentHistory() {
    const yearFilter = document.getElementById('yearFilter').value;
    const packageFilter = document.getElementById('packageFilter').value;
    
    // Get all payment history rows
    const rows = document.querySelectorAll('#paymentHistoryBody tr');
    
    rows.forEach(row => {
        // Skip the empty state row if it exists
        if (row.classList.contains('empty-state')) return;
        
        const dateCell = row.cells[0]?.textContent;
        const packageCell = row.cells[2]?.textContent;
        
        if (dateCell && packageCell) {
            const date = new Date(dateCell);
            const year = date.getFullYear().toString();
            
            const yearMatch = yearFilter === 'all' || year === yearFilter;
            const packageMatch = packageFilter === 'all' || 
                               packageCell.toLowerCase().includes(packageFilter.toLowerCase());
            
            row.style.display = yearMatch && packageMatch ? '' : 'none';
        }
    });
    
    // Check if any rows are visible
    const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
    
    // Show empty state if no rows are visible
    const tableBody = document.getElementById('paymentHistoryBody');
    if (visibleRows.length === 0) {
        // Only show empty state if it doesn't already exist
        if (!document.querySelector('.empty-state')) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <p>No payments found for selected filters</p>
                    </td>
                </tr>
            `;
        }
    }
}

// Update your document ready event listener to include this
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();

    // Add filter change listeners
    const yearFilter = document.getElementById('yearFilter');
    const packageFilter = document.getElementById('packageFilter');
    
    if (yearFilter) yearFilter.addEventListener('change', filterPaymentHistory);
    if (packageFilter) packageFilter.addEventListener('change', filterPaymentHistory);
});
// Modify your form submission code to include the loading animation

// Function to generate a shorter transaction ID
function generateShortTransactionId(bookingData) {
    const date = new Date(bookingData.paymentCompletedAt.toDate());
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Use last 3 characters of sessionId instead of random
    const uniquePart = bookingData.sessionId.slice(-3).toUpperCase();
    
    return `TXN${year}${month}${day}-${uniquePart}`;
}

// Function to mask payment method
function maskPaymentMethod(sessionId) {
    // Extract last 4 characters from sessionId as a proxy for card number
    const last4 = sessionId.slice(-4);
    return `xxxx-xxxx-xxxx-${last4}`;
}
async function getLogoUrl() {
    try {
        const logoRef = ref(storage, 'gs://trial-17319.firebasestorage.app/logo1.png'); // Replace with your logo path
        const url = await getDownloadURL(logoRef);
        return url;
    } catch (error) {
        console.error('Error getting logo URL:', error);
        return null;
    }
}

async function generateProfessionalReceipt(bookingId) {
    try {
        const user = auth.currentUser;
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        
        if (!bookingDoc.exists()) {
            throw new Error('Booking not found');
        }

        const logoUrl = await getLogoUrl();
        const bookingData = bookingDoc.data();
        const shortTransactionId = generateShortTransactionId(bookingData);
        

        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Payment Receipt - ${shortTransactionId}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    
                    body {
                        font-family: 'Inter', sans-serif;
                        line-height: 1.6;
                        color: #2c3e50;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px;
                        background: #fff;
                    }

                    .receipt-container {
                        position: relative;
                        border: 1px solid #e1e1e1;
                        border-radius: 12px;
                        padding: 40px;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    }

                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 60px;
                        color: rgba(230, 126, 34, 0.3);
                        white-space: nowrap;
                        z-index: 0;
                    }

                    .receipt-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: top;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #e67e22;
                        padding-bottom: 20px;
                        position: relative;
                        z-index: 1;
                        font-weight: bold;
                    }

                    .company-info {
                        flex: 1;
                    }

                    .company-logo {
                        max-width: 150px;
                        height: auto;
                        margin-bottom: 10px;
                    }

                    .company-details {
                        font-size: 0.9em;
                        color: #666;
                    }

                    .receipt-title {
                        text-align: right;
                        flex: 1;
                    }
                     .company-logo {
                        max-width: 200px;
                        height: auto;
                        margin-bottom: 15px;
                    }

                    .receipt-title h1 {
                        color: #e67e22;
                        margin: 0;
                        font-size: 2em;
                    }

                    .customer-info {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }

                    .payment-info {
                        background: #fff8f3;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        border: 1px solid #ffe4d1;
                    }

                    .payment-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }

                    .payment-table th {
                        background: #f8f9fa;
                        padding: 12px;
                        text-align: left;
                    }

                    .payment-table td {
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                    }

                    .total-row {
                        font-weight: bold;
                        font-size: 1.1em;
                        background: #f8f9fa;
                    }

                    .trip-details {
                        background: #f0f9ff;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border: 1px solid #e1f0ff;
                    }

                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 0.9em;
                        color: #666;
                    }
                    .footer p {
                    font-weight: bold;
                    }

                    .qr-section {
                        text-align: center;
                        margin: 30px 0;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }
                        .receipt-container {
                            border: none;
                            box-shadow: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="watermark">KENYA ON A BUDGET SAFARIS</div>
                    
                    <div class="receipt-header">
                        <div class="company-info">
                             ${logoUrl ? 
                                `<img src="${logoUrl}" alt="Kenya On A Budget Safaris" class="company-logo">` :
                                '<h2>Kenya On A Budget Safaris</h2>'
                            }
                            <div class="company-details">
                                <p>Kenya On A Budget Safaris</p>
                                <p>P.O. Box 00208, Kajiado West, Kenya</p>
                                <p>Tel: +44 7376 642148</p>
                                <p>Email: info@kenyaonabudgetsafaris.co.uk</p>
                            </div>
                        </div>
                        <div class="receipt-title">
                            <h1>RECEIPT</h1>
                            <p style="color: #e67e22; font-size: 1.2em;">Transaction ID: ${shortTransactionId}</p>
                            <p>Date: ${bookingData.paymentCompletedAt.toDate().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</p>
                        </div>
                    </div>

                    <div class="customer-info">
                        <h2 style="color: #e67e22; margin-top: 0;">Customer Information</h2>
                        <p><strong>Name:</strong> ${user.displayName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
                    </div>

                    

                    <div class="trip-details">
                        <h2 style="color: #e67e22; margin-top: 0;">Trip Details</h2>
                        <p><strong>Package:</strong> ${bookingData.packageName}</p>
                        <p><strong>Duration:</strong> ${bookingData.duration}</p>
                        <p><strong>Travel Dates:</strong> ${bookingData.dates.arrival.date} - ${bookingData.dates.departure.date}</p>
                    </div>

                    <div class="payment-details">
                        <table class="payment-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Duration</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${bookingData.packageName}</td>
                                    <td>${bookingData.duration}</td>
                                    <td>£${bookingData.cost.toFixed(2)}</td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="2">Total Amount Paid</td>
                                    <td>£${bookingData.cost.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="qr-section">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${shortTransactionId}" 
                             alt="Verification QR Code" 
                             style="width: 100px; height: 100px;">
                        <p style="color: #666; font-size: 0.8em;">Scan to verify receipt authenticity</p>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing Kenya On A Budget Safaris!</p>
                        <p>This is an electronically generated receipt.</p>
                        <p>For any queries, please contact our support team at <a href="mailto:info@kenyaonabudgetsafaris.co.uk">info@kenyaonabudgetsafaris.co.uk</a></p>
                        <p>© ${new Date().getFullYear()} Kenya On A Budget Safaris. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Create and trigger download
        const blob = new Blob([receiptHTML], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receipt-${shortTransactionId}.html`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error generating receipt:', error);
        alert('Error generating receipt. Please try again.');
    }
}

// Modified loadPaymentData function
// Add this function at the top of your JavaScript


// Modified loadPaymentData function
async function loadPaymentData() {
    try {
        const user = auth.currentUser;
        console.log('Checking current user in loadPaymentData:', user);

        if (!user) {
            console.log('Waiting for auth state...');
            return;
        }

        console.log('Loading payment data for user:', user.uid);

        // Get booking data
        const bookingRef = doc(db, 'bookings', user.uid);
        const bookingSnap = await getDoc(bookingRef);

        console.log('Booking exists:', bookingSnap.exists());

        if (bookingSnap.exists()) {
            const bookingData = bookingSnap.data();
            console.log('Found booking data:', bookingData);

            // Generate short transaction ID
            const shortTransactionId = generateShortTransactionId(bookingData);

            // Update package payment card
            const packageAmountElement = document.getElementById('packageAmount');
            if (packageAmountElement) {
                packageAmountElement.textContent = bookingData.cost ? 
                    `£${bookingData.cost.toFixed(2)}` : '£0.00';
            }

            // Update status
            const paymentStatusElement = document.getElementById('paymentStatus');
            if (paymentStatusElement) {
                if (bookingData.paymentStatus) {
                    paymentStatusElement.innerHTML = `
                        <i class="fas fa-check-circle"></i> 
                        ${bookingData.paymentStatus.status || 'No status'}
                    `;
                }
            }

            // Update payment date
            if (bookingData.paymentCompletedAt) {
                const paymentDateTime = bookingData.paymentCompletedAt.toDate();
                const paymentDateElement = document.getElementById('paymentDate');
                const paymentTimeElement = document.getElementById('paymentTime');
                
                if (paymentDateElement) {
                    paymentDateElement.textContent = paymentDateTime.toLocaleDateString();
                }
                if (paymentTimeElement) {
                    paymentTimeElement.textContent = paymentDateTime.toLocaleTimeString();
                }
            }

            // Update transaction details with short ID
            const transactionIdElement = document.getElementById('transactionId');
            const transactionStatusElement = document.getElementById('transactionStatus');
            const packageNameElement = document.getElementById('packageName');

            if (transactionIdElement) {
                transactionIdElement.textContent = shortTransactionId;
            }
            if (transactionStatusElement) {
                transactionStatusElement.textContent = bookingData.status || 'No status';
            }
            if (packageNameElement) {
                packageNameElement.textContent = bookingData.packageName || 'No package selected';
            }

            // Update payment history table
            const tableBody = document.getElementById('paymentHistoryBody');
            console.log('Found table body:', tableBody);

            if (tableBody) {
                if (bookingData.paymentStatus?.status === 'completed') {
                    const paymentDate = bookingData.paymentCompletedAt ? 
                        bookingData.paymentCompletedAt.toDate().toLocaleDateString() : 'N/A';

                    console.log('Setting payment history row with date:', paymentDate);

                    tableBody.innerHTML = `
                        <tr>
                            <td>${paymentDate}</td>
                            <td class="transaction-id">${shortTransactionId}</td>
                            <td>${bookingData.packageName || 'N/A'}</td>
                            <td>£${bookingData.cost ? bookingData.cost.toFixed(2) : '0.00'}</td>
                            <td>
                                <span class="card-status status-paid">
                                    ${bookingData.paymentStatus?.status || 'N/A'}
                                </span>
                            </td>
                            <td>
                                <button class="download-btn" onclick="downloadReceipt('${user.uid}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="empty-state">
                                <i class="fas fa-receipt"></i>
                                <p>No completed payments found</p>
                            </td>
                        </tr>
                    `;
                }
            }
        }

    } catch (error) {
        console.error('Error in loadPaymentData:', error);
    }
}

// Add visibility observer for payments section
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, setting up payment section observer');
    
    const paymentsSection = document.getElementById('payments');
    if (paymentsSection) {
        console.log('Found payments section, setting up observer');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.style.display !== 'none') {
                    console.log('Payments section visible, checking auth state');
                    if (auth.currentUser) {
                        console.log('User authenticated, loading payment data');
                        loadPaymentData();
                    } else {
                        console.log('No user authenticated when section became visible');
                    }
                }
            });
        });

        observer.observe(paymentsSection, {
            attributes: true,
            attributeFilter: ['style']
        });
    } else {
        console.log('Payments section not found in DOM');
    }
});
// Make sure downloadReceipt is globally available
window.downloadReceipt = async function(uid) {
    try {
        const bookingDoc = await getDoc(doc(db, 'bookings', uid));
        if (!bookingDoc.exists()) {
            throw new Error('Booking not found');
        }
        const bookingData = bookingDoc.data();
        // Call your existing receipt generator with the booking data
        generateProfessionalReceipt(uid);
    } catch (error) {
        console.error('Error downloading receipt:', error);
        alert('Error downloading receipt. Please try again.');
    }
};
// Add this to ensure the receipt download function is globally available
window.downloadReceipt = function(bookingId) {
    generateProfessionalReceipt(bookingId);
};

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    loadPaymentData();

    // Add filter change listeners
    const yearFilter = document.getElementById('yearFilter');
    const packageFilter = document.getElementById('packageFilter');
    
    if (yearFilter) yearFilter.addEventListener('change', filterPaymentHistory);
    if (packageFilter) packageFilter.addEventListener('change', filterPaymentHistory);
});

// Function to generate unique booking reference
function generateBookingReference(bookingId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `KOB-${year}${month}${day}-${randomStr}`;
}
//const storage = getStorage(app);
// Initialize message listeners
async function initializeMessaging() {
    const user = auth.currentUser;
    if (!user) return;

    // Set up real-time listeners for messages
    const messagesRef = collection(db, 'messages');
    const userMessagesQuery = query(
        messagesRef,
        where('participants', 'array-contains', user.uid),
        orderBy('timestamp', 'desc')
    );

    // Listen for new messages
    onSnapshot(userMessagesQuery, (snapshot) => {
        let unreadCount = 0;
        const chatListEl = document.querySelector('.chat-list');
        chatListEl.innerHTML = '';

        snapshot.forEach((doc) => {
            const messageData = doc.data();
            if (!messageData.readBy?.includes(user.uid)) {
                unreadCount++;
            }
            chatListEl.appendChild(createChatListItem(messageData));
        });

        // Update badges
        updateMessagesBadge(unreadCount);
    });

    // Set up notifications listener
    const notificationsRef = collection(db, 'notifications');
    const userNotificationsQuery = query(
        notificationsRef,
        where('userId', '==', user.uid),
        where('read', '==', false),
        orderBy('timestamp', 'desc')
    );

    onSnapshot(userNotificationsQuery, (snapshot) => {
        const notificationsList = document.querySelector('.notifications-panel .panel-content');
        notificationsList.innerHTML = '';
        
        let unreadNotifications = 0;
        snapshot.forEach((doc) => {
            const notificationData = doc.data();
            if (!notificationData.read) {
                unreadNotifications++;
            }
            notificationsList.appendChild(createNotificationItem(doc.id, notificationData));
        });

        // Update notification badge
        updateNotificationsBadge(unreadNotifications);
    });
}

// Create chat list item
function createChatListItem(messageData) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
        <img src="${messageData.senderAvatar || 'default-avatar.png'}" class="chat-avatar" alt="User">
        <div class="chat-info">
            <div class="chat-name">${messageData.senderName}</div>
            <div class="chat-preview">${messageData.lastMessage}</div>
        </div>
        <div class="chat-meta">
            <div class="chat-time">${formatTimestamp(messageData.timestamp)}</div>
            ${!messageData.read ? '<div class="unread-count">1</div>' : ''}
        </div>
    `;

    div.addEventListener('click', () => openChat(messageData.chatId));
    return div;
}

// Create notification item
function createNotificationItem(notificationId, notificationData) {
    const div = document.createElement('div');
    div.className = 'notification-item' + (notificationData.read ? '' : ' unread');
    div.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${getNotificationIcon(notificationData.type)}"></i>
        </div>
        <div class="notification-content">
            <p>${notificationData.message}</p>
            <div class="notification-time">${formatTimestamp(notificationData.timestamp)}</div>
        </div>
    `;

    // Mark as read when clicked
    div.addEventListener('click', () => markNotificationRead(notificationId));
    return div;
}

// Update badges
function updateMessagesBadge(count) {
    const badge = document.querySelector('.messages-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

function updateNotificationsBadge(count) {
    const badge = document.querySelector('.notifications-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.add('active');
    } else {
        badge.classList.remove('active');
    }
}

// Handle new message sending
async function sendMessage(recipientId, content) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const messageRef = collection(db, 'messages');
        await addDoc(messageRef, {
            senderId: user.uid,
            senderName: user.displayName,
            recipientId: recipientId,
            content: content,
            timestamp: new Date(),
            read: false,
            participants: [user.uid, recipientId]
        });
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Support chat functionality
async function initializeSupportChat() {
    const user = auth.currentUser;
    if (!user) return;

    const supportChatRef = collection(db, 'supportChats');
    const userSupportChat = query(
        supportChatRef,
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
    );

    onSnapshot(userSupportChat, (snapshot) => {
        const chatMessages = document.getElementById('supportChatMessages');
        chatMessages.innerHTML = '';

        snapshot.forEach((doc) => {
            const messageData = doc.data();
            const messageEl = createSupportChatMessage(messageData);
            chatMessages.appendChild(messageEl);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// Create support chat message
// Create support chat message (continued)
function createSupportChatMessage(messageData) {
    const div = document.createElement('div');
    div.className = `message ${messageData.isSupport ? 'received' : 'sent'}`;
    div.innerHTML = `
        <div class="message-content">${messageData.content}</div>
        <div class="message-time">${formatTimestamp(messageData.timestamp)}</div>
    `;
    return div;
}

// Handle support chat form submission
document.querySelector('.support-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const input = document.getElementById('supportMessageInput');
    const content = input.value.trim();
    if (!content) return;

    try {
        const supportChatRef = collection(db, 'supportChats');
        await addDoc(supportChatRef, {
            userId: user.uid,
            userName: user.displayName,
            content: content,
            timestamp: new Date(),
            isSupport: false
        });

        // Clear input
        input.value = '';
    } catch (error) {
        console.error('Error sending support message:', error);
        alert('Failed to send message. Please try again.');
    }
});

// Utility function to format timestamps
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    // Otherwise
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Get notification icon based on type
function getNotificationIcon(type) {
    switch (type) {
        case 'offer':
            return 'fa-tag';
        case 'update':
            return 'fa-bell';
        case 'message':
            return 'fa-envelope';
        default:
            return 'fa-info-circle';
    }
}

// Mark notification as read
async function markNotificationRead(notificationId) {
    try {
        const notificationRef = doc(db, 'notifications', notificationId);
        await updateDoc(notificationRef, {
            read: true
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Open chat with specific user
async function openChat(chatId) {
    const chatArea = document.querySelector('.active-chat');
    const chatList = document.querySelector('.chat-list');
    const user = auth.currentUser;
    
    if (!user) return;

    try {
        // Get chat messages
        const messagesRef = collection(db, 'messages');
        const chatMessages = query(
            messagesRef,
            where('chatId', '==', chatId),
            orderBy('timestamp')
        );

        // Show chat area, hide chat list
        chatArea.style.display = 'flex';
        chatList.style.display = 'none';

        // Load messages
        const messagesSnapshot = await getDocs(chatMessages);
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = '';

        messagesSnapshot.forEach((doc) => {
            const messageData = doc.data();
            const messageEl = createChatMessage(messageData, user.uid);
            messagesContainer.appendChild(messageEl);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Mark messages as read
        messagesSnapshot.forEach(async (doc) => {
            const messageData = doc.data();
            if (messageData.recipientId === user.uid && !messageData.read) {
                await updateDoc(doc.ref, {
                    read: true,
                    readTimestamp: new Date()
                });
            }
        });
    } catch (error) {
        console.error('Error opening chat:', error);
        alert('Failed to load chat messages. Please try again.');
    }
}

// Create chat message element
function createChatMessage(messageData, currentUserId) {
    const div = document.createElement('div');
    div.className = `message ${messageData.senderId === currentUserId ? 'sent' : 'received'}`;
    div.innerHTML = `
        <div class="message-content">${messageData.content}</div>
        <div class="message-time">${formatTimestamp(messageData.timestamp)}</div>
    `;
    return div;
}

// Handle new message modal
const newMessageModal = {
    show() {
        document.querySelector('.new-message-modal').style.display = 'flex';
    },
    hide() {
        document.querySelector('.new-message-modal').style.display = 'none';
    },
    async send() {
        const recipient = document.getElementById('messageRecipient').value;
        const content = document.getElementById('messageContent').value.trim();
        
        if (!recipient || !content) {
            alert('Please fill in all fields');
            return;
        }

        try {
            await sendMessage(recipient, content);
            this.hide();
            // Clear form
            document.getElementById('messageContent').value = '';
            document.getElementById('messageRecipient').value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize messaging and notifications
    initializeMessaging();
    initializeSupportChat();

    // New message button
    document.querySelector('.new-message-btn')?.addEventListener('click', () => {
        newMessageModal.show();
    });

    // Modal close button
    document.querySelector('.new-message-modal .close-modal')?.addEventListener('click', () => {
        newMessageModal.hide();
    });

    // Modal send button
    document.querySelector('.new-message-modal .send-btn')?.addEventListener('click', () => {
        newMessageModal.send();
    });

    // Back to chat list button
    document.querySelector('.back-to-chats')?.addEventListener('click', () => {
        document.querySelector('.active-chat').style.display = 'none';
        document.querySelector('.chat-list').style.display = 'block';
    });

    // Mark all notifications as read
    document.querySelectorAll('.clear-all').forEach(button => {
        button.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const notificationsRef = collection(db, 'notifications');
                const unreadQuery = query(
                    notificationsRef,
                    where('userId', '==', user.uid),
                    where('read', '==', false)
                );

                const snapshot = await getDocs(unreadQuery);
                snapshot.forEach(async (doc) => {
                    await updateDoc(doc.ref, { read: true });
                });
            } catch (error) {
                console.error('Error marking notifications as read:', error);
            }
        });
    });
});