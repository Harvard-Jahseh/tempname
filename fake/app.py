from flask import Flask, render_template, redirect, request, url_for, g, session

app = Flask(__name__)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/apply', methods=["GET", "POST"])
def apply():
    if (request.method == "GET"):
        return render_template("apply.html")
    else:
        race = request.form.getlist("race")
        if (race[-1] == ""): race = race[:-1]
        try:
            otherRace = request.form["other_race"]
            race.append(otherRace)
        except:
            pass

        gender = request.form["gender"]
        legallyAuthorized = request.form["legally_authorized"]
        willRequire = request.form["require_sponsorship"]
        canVerify = request.form["submit_verification"]
        disabilityStatus = request.form["disability_radio"]
        veteranStatus = request.form["veteran_radio"]
        return render_template("submitted.html", **locals())



if __name__ == "__main__":
	app.run(port="5000")
