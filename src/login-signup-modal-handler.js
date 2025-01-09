//login and signup
const modal = document.getElementById("loginModal");
const loginSignupButton = document.getElementById("login");
const closeModal = document.getElementById("closeModal");
const defaultTab = document.getElementById("defaultOpen");
const signupForm = document.getElementById("signupForm");
const profileButton = document.getElementById("profile");

//open modal when button is clicked
loginSignupButton.addEventListener('click', () => {
  modal.style.display="flex";
})

//close modal when x is clicked
closeModal.addEventListener('click', () => {
  modal.style.display="none";
})

//close modal when user clicks outside modal
window.addEventListener('click', (event) => {
  if(event.target == modal){
    modal.style.display="none";
  }
})

//open login/signup form
function openTab(evt, formName){
  const tabContents = document.getElementsByClassName("tabcontent");
  for(let i=0; i<tabContents.length; i++){
    tabContents[i].style.display = "none";
  }
  const tabLinks = document.getElementsByClassName("tablinks");
  for(let i=0; i<tabLinks.length; i++){
    tabLinks[i].classList.remove("active");
  }
  document.getElementById(formName).style.display = "flex";
  evt.currentTarget.classList.add("active");
}

//set default tab to "Login"
defaultTab.click();


//signup logic
document.getElementById("SignupForm").addEventListener("submit", async(e) => {
  e.preventDefault();
  const email = e.target.elements[0].value;
  const password = e.target.elements[1].value;
  const confirmPassword = e.target.elements[2].value;

  if(password !== confirmPassword){
    alert("Passwords do not match!");
    return;
  }

  try{
    const response = await fetch("https://localhost:7275/api/Authentication/register", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password}),
    });

    if(response.ok){
      alert("Signup successful! You can now log into your account.");
      defaultTab.click();
      signupForm.reset();
    }
    else{
      const error = await response.json();
      alert(error.message || "Signup failed!");
    }
  }
  catch(err)
  {
    console.error(err);
    alert("Error occured during signup!");
  }
});

//decode JWT token
function decodeToken(token) {
  const payloadBase64 = token.split('.')[1];
  const decodedPayload = atob(payloadBase64);
  // console.log(decodedPayload);
  return JSON.parse(decodedPayload);
}


//login logic
document.getElementById("loginForm").addEventListener("submit", async(e) => {
  e.preventDefault();
  const email = e.target.elements[0].value;
  const password = e.target.elements[1].value;

  // console.log("Email:", email);
  // console.log("Password:", password);

  try{
    const response = await fetch("https://localhost:7275/api/Authentication/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({  
      email: email.trim(), 
      password: password.trim()
    })
  });

  // console.log(password);

  if(response.ok){
    const {token} = await response.json();
    localStorage.setItem("token", token);
    alert("Login Successful!");
    // window.location.href = "/dashboard.html";
    modal.style.display = "none";

    if(token){
      try{
        const decodedToken = decodeToken(token);
        const userEmail = decodedToken.unique_name;
  
        //hide login/signup button
        loginSignupButton.style.display = "none";
  
        //show Profile button
        profileButton.style.display = "flex";
        // console.log(decodedToken.email);
        profileButton.textContent = userEmail;
  
        //remove login/signup popup
        modal.style.display = "none";
  
        //add click listener for Profile button
        profileButton.addEventListener("click", () => {
          window.location.href = "/profile.html";
        })
      }
      catch(error)
      {
        console.error("Invalid token format or error decoding token! ", error);
        //clear token if it is invalid
        localStorage.removeItem("token");
      }
    }
    else{
      loginSignupButton.style.display = "flex";
      profileButton.style.display = "none";
      modal.style.display = "flex";
    }
  }
  else{
    const error = await response.json();
    alert(error.message || "Invalid Credentials! Please try again.");
  }
  }
  catch(err)
  {
    console.error(err);
    alert("Error occured during login!");
  }
});

//TODO add logout button
//TODO fix textbox and button sizes auto scaling