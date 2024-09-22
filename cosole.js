if (window.location.origin !== "https://www.instagram.com") {
  window.alert(
    "Hey! You need to be on the Instagram site before you run the code. I'm taking you there now, but you'll have to run the code in the console again."
  );
  window.location.href = "https://www.instagram.com";
  console.clear();
}

const fetchOptions = {
  credentials: "include",
  headers: {
    "X-IG-App-ID": "936619743392459",
  },
  method: "GET",
};

let username;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

const concatFriendshipsApiResponse = async (
  list,
  user_id,
  count,
  next_max_id = ""
) => {
  let url = `https://www.instagram.com/api/v1/friendships/${user_id}/${list}/?count=${count}`;
  if (next_max_id) {
    url += `&max_id=${next_max_id}`;
  }

  const data = await fetch(url, fetchOptions).then((r) => r.json());

  if (data.next_max_id) {
    const timeToSleep = random(800, 1500);
    console.log(
      `Loaded ${data.users.length} ${list}. Sleeping ${timeToSleep}ms to avoid rate limiting`
    );

    await sleep(timeToSleep);

    return data.users.concat(
      await concatFriendshipsApiResponse(list, user_id, count, data.next_max_id)
    );
  }

  return data.users;
};

const getFollowers = (user_id, count = 50, next_max_id = "") => {
  return concatFriendshipsApiResponse("followers", user_id, count, next_max_id);
};

const getFollowing = (user_id, count = 50, next_max_id = "") => {
  return concatFriendshipsApiResponse("following", user_id, count, next_max_id);
};

const getUserId = async (username) => {
  const lower = username.toLowerCase();
  const url = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${lower}&include_reel=false`;
  const data = await fetch(url, fetchOptions).then((r) => r.json());

  const result = data.users?.find(
    (result) => result.user.username.toLowerCase() === lower
  );

  return result?.user?.pk || null;
};

const getUserFriendshipStats = async (username) => {
  const user_id = await getUserId(username);

  if (!user_id) {
    throw new Error(`Could not find user with username ${username}`);
  }

  const followers = await getFollowers(user_id);
  const following = await getFollowing(user_id);

  const followersUsernames = followers.map((follower) =>
    follower.username.toLowerCase()
  );
  const followingUsernames = following.map((followed) =>
    followed.username.toLowerCase()
  );

  const followerSet = new Set(followersUsernames);
  const followingSet = new Set(followingUsernames);

  console.log("-".repeat(28));
  console.log(
    `Fetched ${followerSet.size} followers and ${followingSet.size} following.`
  );
  console.log(
    `If this doesn't seem right, then some of the output might be inaccurate.`
  );

  const PeopleIDontFollowBack = Array.from(followerSet).filter(
    (follower) => !followingSet.has(follower)
  );

  const PeopleNotFollowingMeBack = Array.from(followingSet).filter(
    (following) => !followerSet.has(following)
  );

  return {
    PeopleIDontFollowBack,
    PeopleNotFollowingMeBack,
  };
};

const getCSRFToken = () => {
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1];

  if (!csrfToken) {
    throw new Error("Could not find CSRF token in cookies");
  }

  return csrfToken;
};

const unfollowUser = async (user_id) => {
  const url = `https://www.instagram.com/web/friendships/${user_id}/unfollow/`;
  const csrfToken = getCSRFToken();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": csrfToken,
      "X-IG-App-ID": "936619743392459",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to unfollow user ID ${user_id}: ${response.status} ${errorText}`
    );
  }

  return response.json();
};

const unfollowUsers = async (usernames) => {
  for (const username of usernames) {
    try {
      const user_id = await getUserId(username);
      if (!user_id) {
        console.log(`Could not find user ID for username: ${username}`);
        continue;
      }

      const result = await unfollowUser(user_id);
      console.log(`Successfully unfollowed ${username}`);
    } catch (error) {
      console.error(`Error unfollowing ${username}:`, error);
    }

    // Sleep to avoid rate limiting
    const timeToSleep = random(2000, 5000); // Wait between 2-5 seconds
    console.log(`Waiting for ${timeToSleep}ms to avoid rate limiting...`);
    await sleep(timeToSleep);
  }
};

// Replace "your_username" with your Instagram username
username = "your_username";

(async () => {
  try {
    const { PeopleIDontFollowBack, PeopleNotFollowingMeBack } =
      await getUserFriendshipStats(username);

    console.log("People I Don't Follow Back:", PeopleIDontFollowBack);
    console.log("People Not Following Me Back:", PeopleNotFollowingMeBack);

    const proceed = window.confirm(
      `You are about to unfollow ${PeopleNotFollowingMeBack.length} users who are not following you back. Do you want to continue?`
    );

    if (proceed) {
      await unfollowUsers(PeopleNotFollowingMeBack);
      console.log("Finished unfollowing users.");
    } else {
      console.log("Operation canceled by the user.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
