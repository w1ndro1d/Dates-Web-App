//login and signup
const modal = document.getElementById("loginModal");
const loginSignupLink = document.getElementById("login");
const closeModal = document.getElementById("closeModal");
const defaultTab = document.getElementById("defaultOpen");
const signupForm = document.getElementById("signupForm");
const loginSignupButton = document.getElementById("login");

//open modal when button is clicked
loginSignupLink.addEventListener('click', () => {
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
  document.getElementById(formName).style.display = "block";
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


//TO-DO fix login logic
//login logic
document.getElementById("LoginForm").addEventListener("submit", async(e) => {
  e.preventDefault();
  const email = e.target.elements[0].value;
  const password = e.target.elements[1].value;

  try{
    const response = await fetch("https://localhost:7275/api/Authentication/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email, password}),
  });

  // console.log(await response.json());

  if(response.ok){
    const {token} = await response.json();
    localStorage.setItem("token", token);

    //decode JWT token for user info
    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const userEmail = decodedToken.email;

    //replace login/signup button with profile button
    loginSignupButton.style.display = "none";

    const profileButton = document.createElement("button");
    profileButton.textContent = '${userEmail}';
    profileButton.id = 'profileButton';
    profileButton.classList.add("profile-button");

    //TO-DO profile page
    profileButton.addEventListener("click", () => {
      window.location.href = "/dashboard.html";
    });

    alert("Login Successful!");
    modal.style.display = "none";
    window.location.href = "/dashboard.html";
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
