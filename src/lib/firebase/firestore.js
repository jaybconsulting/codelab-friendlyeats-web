import { generateFakeRestaurantsAndReviews } from "@/src/lib/fakeRestaurants.js";

import {
	collection,
	onSnapshot,
	query,
	getDocs,
	doc,
	getDoc,
	updateDoc,
	orderBy,
	Timestamp,
	runTransaction,
	where,
	addDoc,
	getFirestore,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase/clientApp";

export async function updateRestaurantImageReference(
	restaurantId,
	publicImageUrl
) {
	const restaurantRef = doc(collection(db, "restaurants"), restaurantId);
	if (restaurantRef) {
		await updateDoc(restaurantRef, { photo: publicImageUrl });
	}
}

const updateWithRating = async (
	transaction,
	docRef,
	newRatingDocument,
	review
) => {
	const restaurant = await transaction.get(docRef);
	const restaurantData = restaurant.data();

	const newNumRatings = (restaurantData?.numRatings || 0) + 1;
	const newSumRatings = (restaurantData?.sumRating  || 0) + Number(review.rating);
	const newAvgRating = newSumRatings / newNumRatings;

	transaction.update(docRef, { 
		numRatings: newNumRatings,
		sumRating: newSumRatings,
		avgRating: newAvgRating,
	});

	transaction.set(newRatingDocument, { 
		...review,
		timestamp: Timestamp.fromDate(new Date()),
	});
};

export async function addReviewToRestaurant(db, restaurantId, review) {
	if (!restaurantId) {
		throw new Error("No restaurant ID has been provided");
	}
	if (!review) {
		throw new Error("No review has been provided");
	}

	const restaurantDocRef = doc(db, "restaurants", restaurantId);
	const newRatingDocRef = doc(collection(db, "restaurants", restaurantId, "ratings"));

	try {
		await runTransaction(db, async (transaction) => {
			updateWithRating(transaction, restaurantDocRef, newRatingDocRef, review);
		});
	} catch (e) {
		console.log("Error adding rating to restaurant", e);
	}
}

function applyQueryFilters(q, { category, city, price, sort }) {
	if (category) {
		q = query(q, where("category", "==", category));
	}
	if (city) {
		q = query(q, where("city", "==", city));
	}
	if (price) {
		q = query(q, where("price", "==", price));
	}
	if (sort === "Rating" || !sort) {
		q = query(q, orderBy("avgRating", "desc"));
	} else if (sort === "Review") {
		q = query(q, orderBy("numRatings", "desc"));
	}

	return q;
}

export async function getRestaurants(db = db, filters = {}) {
	let q = query(collection(db, "restaurants"));

	q = applyQueryFilters(q, filters);

	const results = await getDocs(q);

	return results.docs.map((doc) => {
		return {
			id: doc.id,
			...doc.data(),
			timestamp: doc.data().timestamp.toDate()
		}
	});
}

export function getRestaurantsSnapshot(cb, filters = {}) {
	if (typeof cb !== "function") {
		console.log("Error: the callback parameter is not a function");
		return;
	}
	
	let q = query(collection(db, "restaurants"));

	q = applyQueryFilters(q, filters);

	const unsubscribe = onSnapshot(q, (snapshot) => {
		const restaurants = snapshot.docs.map(restaurant => {
			return {
				id: restaurant.id,
				...restaurant.data(),
				timestamp: restaurant.data().timestamp.toDate(),
			};
		});

		cb(restaurants);
	});
	
	return unsubscribe;
}

export async function getRestaurantById(db, restaurantId) {
	if (!restaurantId) {
		console.log("Error: Invalid ID received: ", restaurantId);
		return;
	}
	const docRef = doc(db, "restaurants", restaurantId);
	const docSnap = await getDoc(docRef);
	return {
		...docSnap.data(),
		timestamp: docSnap.data().timestamp.toDate(),
	};
}

export function getRestaurantSnapshotById(restaurantId, cb) {
	return;
}

export async function getReviewsByRestaurantId(db, restaurantId) {
	if (!restaurantId) {
		console.log("Error: Invalid restaurantId received: ", restaurantId);
		return;
	}

	const q = query(
		collection(db, "restaurants", restaurantId, "ratings"),
		orderBy("timestamp", "desc")
	);

	const results = await getDocs(q);
	return results.docs.map(doc => {
		return {
			id: doc.id,
			...doc.data(),
			// Only plain objects can be passed to Client Components from Server Components
			timestamp: doc.data().timestamp.toDate(),
		};
	});
}

export function getReviewsSnapshotByRestaurantId(restaurantId, cb) {
	if (!restaurantId) {
		console.log("Error: Invalid restaurantId received: ", restaurantId);
		return;
	}

	const q = query(
		collection(db, "restaurants", restaurantId, "ratings"),
		orderBy("timestamp", "desc")
	);
	const unsubscribe = onSnapshot(q, querySnapshot => {
		const results = querySnapshot.docs.map(doc => {
			return {
				id: doc.id,
				...doc.data(),
				// Only plain objects can be passed to Client Components from Server Components
				timestamp: doc.data().timestamp.toDate(),
			};
		});
		cb(results);
	});
	return unsubscribe;
}

export async function addFakeRestaurantsAndReviews() {
	const data = await generateFakeRestaurantsAndReviews();
	for (const { restaurantData, ratingsData } of data) {
		try {
			const docRef = await addDoc(
				collection(db, "restaurants"),
				restaurantData	
			);

			for (const ratingData of ratingsData) {
				await addDoc(
					collection(db, "restaurants", docRef.id, "ratings"),
					ratingData
				);
			}
		} catch (e) {
			console.log("There was an error adding the document");
			console.error("Error adding document: ", e);
		}
	}
}
