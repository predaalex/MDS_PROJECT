const express = require('express');
const fs=require('fs');
const sharp=require('sharp');
const ejs=require('ejs');
const sass=require('sass');
const path = require('path');
const {Client}=require('pg');
const request=require('request');
const formidable = require('formidable');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
const html_to_pdf = require('html-pdf-node');

var client = new Client({user:'buki',password:'buki', database:'postgres', host: 'localhost', port:5432});
client.connect();

app=express();

app.use(["/produse_cos","/cumpara"],express.json({limit:'2mb'}));//obligatoriu de setat pt request body de tip json

//crearea sesiunii (obiectul de tip request capata proprietatea session si putem folosi req.session)
app.use(session({
    secret: 'abcdefg',//folosit de express session pentru criptarea id-ului de sesiune
    resave: true,
    saveUninitialized: false
  }));

app.use("/*", function(req,res,next){
    res.locals.utilizator=req.session.utilizator;
    //TO DO de adaugat vectorul de optiuni pentru meniu (sa se transmita pe toate paginile)
    next();
});

app.get("/produsele_noastre", function(req, res){
    client.query(`SELECT * FROM prods`, function(err,rez){
        if(!err){
            res.render("pagini/produsele_noastre",{produse:rez.rows})
        }
        else
            console.log(err);
    })
});

app.get("/produs/:id", function(req, res){
    client.query(`SELECT * FROM prods where id_prods=${req.params.id}`, function(err,rez){
        if(!err){
            res.render("pagini/produs",{prod:rez.rows[0]})
        }
    });
});


app.get("*/galerie-animata.css", function(req,res){
    res.setHeader("Content-Type","text/css");//pregatesc raspunsul de tip css
    let sirScss=fs.readFileSync("./resurse/scss/galerie-animata.scss").toString("utf-8");
    nr_img=[9,12,15];
    let nr_aleator = nr_img[Math.floor(Math.random()*nr_img.length)];
    let rezScss=ejs.render(sirScss,{nr_imagini:nr_aleator});
    fs.writeFileSync("./resurse/temp/galerie-animata.scss",rezScss);

    let cale_css=path.join(__dirname,"resurse/temp","galerie-animata.css");//__dirname+"/temp/galerie-animata.css"
	let cale_scss=path.join(__dirname,"resurse/temp","galerie-animata.scss");

    sass.render({file: cale_scss, sourceMap:true}, function(err, rezCompilare) {
		if (err) {
            console.log(`eroare: ${err.message}`);
            //to do: css default
            res.end();//termin transmisiunea in caz de eroare
            return;
        }
		fs.writeFileSync(cale_css, rezCompilare.css, function(err){
			if(err){console.log(err);}
		});
		res.sendFile(cale_css);
	});
})
app.get("*/galerie-animata.css.map",function(req, res){
    res.sendFile(path.join(__dirname,"resurse/temp/galerie-animata.css.map"));
});

app.set("view engine","ejs");
app.use("/resurse",express.static(__dirname+"/resurse"));

function creeaza_imagini()
{
    var buf=fs.readFileSync(__dirname+"/resurse/json/galerie.json").toString("utf-8");
    obImagini=JSON.parse(buf);
    var vector_imagini=[];
    for(let imag of obImagini.imagini)
    {
        let nume_imag, extensie;
        [nume_imag,extensie]=imag.fisier.split(".");

        let dim_mic=150;
        //imag.mic=nume_imag+"-"+dim_mic+".jpg";
        imag.mic=`${obImagini.cale_galerie}/${nume_imag}-${dim_mic}.jpg`;
        imag.mare=`${obImagini.cale_galerie}/${nume_imag}.jpg`;

        if (!fs.existsSync(imag.mic)){
            ;//sharp(__dirname+"/"+imag.mare).resize(dim_mic).toFile(__dirname+"/"+imag.mic);
        }
        

    }
}

creeaza_imagini();

app.get(["/","/home","/index"], function(req, res){
    var buf_an=fs.readFileSync(__dirname+"/resurse/json/galerie-animata.json").toString("utf-8");
    obImagini_an=JSON.parse(buf_an);
    var locatie="";
    request('https://secure.geobytes.com/GetCityDetails?key=7c756203dbb38590a66e01a5a3e1ad96&fqcn=109.99.96.15', //se inlocuieste cu req.ip; se testeaza doar pe Heroku
            function (error, response, body) {
            if(error) {console.error('error:', error)}
            else{
                var obiectLocatie=JSON.parse(body);
                locatie=obiectLocatie.geobytescountry+" "+obiectLocatie.geobytesregion
            }

    res.render("pagini/index",{ip:req.ip, imagini:obImagini.imagini, cale:obImagini.cale_galerie, 
        imagini_an:obImagini_an.imagini, cale_an:obImagini_an.cale_galerie, locatie:locatie})
    })
});

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

var test_string = makeid(7);

async function trimiteMail(username, email, token){
    var numeDomeniu= require("nodemailer");
	var transp= nodemailer.createTransport({
		service: "gmail",
		secure: false,
		auth:{//date login 
			user:"tehniciwebbuki@gmail.com",
			pass:"ciayuwxwuhsodgde"
		},
		tls:{
			rejectUnauthorized:false
		}
	});
	//genereaza html
	await transp.sendMail({
		from:"tehniciwebbuki@gmail.com",
		to:email,
		subject:"Te-ai inregistrat cu succes",
		text:"Username-ul tau este "+username,
		html:`<h1>Salut!</h1><p style='color:blue'>Username-ul tau este ${username}.</p> <p><a href='http://${numeDomeniu}/cod/${username}/${token}'>Click aici pentru confirmare</a></p>`,
	})
}

app.post("/produse_cos",function(req, res){
    
	//console.log("req.body: ",req.body);
    //console.log(req.get("Content-type"));
    //console.log("body: ",req.get("body"));

    /* prelucrare pentru a avea toate id-urile numerice si pentru a le elimina pe cele care nu sunt numerice */
    var iduri=[]
    for (let elem of req.body.ids_prod){
        let num=parseInt(elem);
        if (!isNaN(num)) //daca este numar
            iduri.push(num);
    }
    if (iduri.length==0){
        res.send("eroare");
        return;
    }
    //console.log("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where id in ("+iduri+")");
    client.query("select * from prods where id_prods in ("+iduri+")", function(err,rez){
        
        
        console.log(rez.rows);
        res.send(rez.rows);
       
       
    });

    
});

app.post("/inreg", function(req,res) {
    var formular= new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFile){
        //verificari - TO DO
        var eroare="";
        if (!campuriText.username)
            eroare+="Username-ul nu poate fi necompletat. ";

        if ( !campuriText.username.match("^[a-zA-Z]{0,1}[a-z0-9A-Z]{0,20}$"))
            eroare+="Username-ul trebuie sa con??in?? maxim 20 caractere, s?? inceap?? cu o liter?? ??i s?? con??in?? doar litere ??i cifre. ";

        if(!campuriText.parola) {
            eroare += "Introduceti o parola!";
        }

        if(!campuriText.rparola) {
            eroare += "Introduceti parola a doua oara!";
        }

        if(!campuriText.email) {
            eroare += "Introduceti un email!";
        }

        if(!campuriText.nume) {
            eroare += "Introduceti un nume!";
        }

        if(!campuriText.prenume) {
            eroare += "Introduceti un prenume!";
        }

        //verificari proprii

        if(campuriText.email.match("^.com$") || campuriText.email.match("^.ro$")) {
            eroare += "Mail invalid!";
        }

        if(!campuriText.nume.match("^[A-Z]")) {
            eroare += "Numele trebuie sa inceapa cu litera mare!";
        }

        if (eroare == "") {
            var quertUsernameUnic = `select * from utilizatori where username = '${campuriText.username}'`;

            client.query(quertUsernameUnic, function(err,rez) {
                if (err) {
                    res.render("pagini/inregistrare", {err: "Probleme la baza de date!"});
                    return;
                }
                console.log(rez.rows.length);
                if (rez.rows.length == 0){
                    var criptareParola = crypto.scryptSync(campuriText.parola, test_string, 64).toString('hex');
                    var queryUtiliz = `INSERT INTO utilizatori (id, username, nume, prenume, parola, rol, email, culoare_chat, data_adaugare, salt) VALUES (DEFAULT,'${campuriText.username}', '${campuriText.nume}', '${campuriText.prenume}', '${criptareParola}', 'comun','${campuriText.email}', '${campuriText.culoareText}', DEFAULT, '${test_string}')`;
                    
                    client.query(queryUtiliz, function(err,rez){
                        if (err) {
                            console.log(err);
                            res.render("pagini/inregistrare", {err: "Eroare la baza de date dupa prima faza!" + err});
                        }
                        else {
                            trimiteMail(campuriText.username, campuriText.email);
                            res.render("pagini/inregistrare", {err: "", raspuns: "Date introduse!"});
                        }
                    });
                }
                else {
                    eroare += "Utilizatorul deja exista!";
                    res.render("pagini/inregistrare",{err:eroare});
                }
            });
        }
        else {
            res.render("pagini/inregistrare",{err:eroare});
        }
    });
});

app.post("/login", function(req,res) {
    var formular= new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFile){
        
        var querylogin=`select * from utilizatori where username= '${campuriText.username}' `;
        client.query(querylogin, function(err, rez){
            if (err) {
                res.render("pagini/404", {err: "eroare baza de date, va rog incercati mai tarziu"});
                return;
            }
            if(rez.rows.length != 1) {
                res.render("pagini/404", {err: "username-ul nu exista"});
                return;
            }

            var criptareParola = crypto.scryptSync(campuriText.parola, rez.rows[0].salt, 64).toString('hex');
            
            if(criptareParola == rez.rows[0].parola) {
                req.session.mesajLogin=null;
                if(req.session){
                    req.session.utilizator={
                        id:rez.rows[0].id,
                        username:rez.rows[0].username,
                        nume:rez.rows[0].nume,
                        prenume:rez.rows[0].prenume,
                        culoare_chat:rez.rows[0].culoare_chat,
                        email:rez.rows[0].email,
                        rol:rez.rows[0].rol
                    }
                }
                res.redirect("/index");
            }
            else{
                req.session.mesajLogin="Login esuat";
                res.redirect("/index");
            }
        });
    });
});

app.get("/ex", function(req,res){
    if(req.session.utilizator)
        res.write("<p style='color:red'>"+req.session.utilizator.nume +" "+req.session.utilizator.prenume+"</p>");
    else {
        res.write("<p>Nu esti logat</p>")
    }

    res.end();
})

app.get("/logout",function(req,res){
    req.session.destroy();
    res.locals.utilizator=null;
    res.render("pagini/logout");
});

app.get('/useri', function(req, res){
	
	if( req.session && req.session.utilizator && req.session.utilizator.rol=="admin" ){
        client.query("select * from utilizatori",function(err, rezultat){
            if(err) throw err;
            res.render('pagini/useri',{useri:rezultat.rows});//afisez index-ul in acest caz
        });
	} 
    else{
		res.status(403).render('pagini/404',{mesaj:"Nu aveti acces"});
	}
    
});


async function trimitefactura2(username, email,numefis){
	var transp= nodemailer.createTransport({
		service: "gmail",
		secure: false,
		auth:{//date login 
            user:"tehniciwebbuki@gmail.com",
			pass:"ciayuwxwuhsodgde"
		},
		tls:{
			rejectUnauthorized:false
		}
	});
	//genereaza html
	await transp.sendMail({
		from:"tehniciwebbuki@gmail.com",
		to:email,
		subject:"Factur??",
		text:"Stimate "+username+", ave??i ata??at?? factura",
		html:"<h1>Salut!</h1><p>Stimate "+username+", ave??i ata??at?? factura</p>",
        attachments: [
            {   // utf-8 string as an attachment
                filename: 'factura.pdf',
                content: fs.readFileSync(numefis)
            }
        ]
	})
	console.log("trimis mail");
}
app.post("/cumpara",function(req, res){
    if(!req.session.utilizator){
        res.write("Nu puteti cumpara daca nu sunteti logat!");res.end();
        return;
    }

    console.log(req.body.ids_prod);

    client.query("select * from prods where id_prods in ("+req.body.ids_prod+")", function(err,rez){
        console.log(err, rez);
        console.log(rez.rows);
        
         let rezFactura=ejs.render(fs.readFileSync("views/pagini/factura.ejs").toString("utf8"),{utilizator:req.session.utilizator,produse:rez.rows});
        //console.log(rezFactura);
        let options = { format: 'A4', args: ['--no-sandbox'] };

        let file = { content: rezFactura };

        html_to_pdf.generatePdf(file, options).then(function(pdf) {
            if(!fs.existsSync("./temp"))
                fs.mkdirSync("./temp");
            var numefis="./temp/test"+(new Date()).getTime()+".pdf";
            fs.writeFileSync(numefis,pdf);
            trimitefactura2(req.session.utilizator.username, req.session.utilizator.email, numefis);
            res.write("Totu bine!");res.end();
        }); 
        // trimiteFactura(req.session.utilizator.nume, "fantomalbastra@gmail.com");
       
    });

    
});

app.post("/managementProduse", function(req,res) {
    var formular= new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFile){
        //verificari - TO DO
        var eroare="";
        if (!campuriText.nume)
            eroare+="Username-ul nu poate fi necompletat. ";

        if(!campuriText.pret) {
            eroare += "Introduceti pretul!";
        }

        if(!campuriText.calorii) {
            eroare += "Introduceti numarul de calorii!";
        }

        if(!campuriText.greutate) {
            eroare += "Introduceti grautatea!";
        }

        //verificari proprii

        if (eroare == "") {
            var queryProdusUnic = `select * from prods where nume = '${campuriText.nume}'`;
            client.query(queryProdusUnic, function(err,rez) {
                if (err) {
                    console.log (err);
                    res.render("pagini/managementProduse", {err: "Probleme la baza de date, prostule!"});
                    return;
                }
                
                if (rez.rows.length != null){
                    var queryUtiliz = `INSERT into prods values (DEFAULT, '${campuriText.nume}', '${campuriText.calorii}', '${campuriText.greutate}', '${campuriText.pret}')`;
                    client.query(queryUtiliz, function(err,rez){
                        if (err) {
                            console.log(err);
                            res.render("pagini/managementProduse", {err: "Eroare la baza de date dupa prima faza!" + err});
                        }
                        else {
                            res.render("pagini/managementProduse", {err: "", raspuns: "Date introduse!"});
                        }
                    });
                }
                else {
                    eroare += "Produsul deja exista!";
                    res.render("pagini/managementProduse",{err:eroare});
                }
            });
        }
        else {
            res.render("pagini/managementProduse",{err:eroare});
        }
    });
});


app.post("/sterge_utiliz",function(req, res){
	if( req.session && req.session.utilizator && req.session.utilizator.rol=="admin"  ){
	var formular= new formidable.IncomingForm()
	
	formular.parse(req, function(err, campuriText, campuriFisier){
		//var comanda=`delete from utilizatori where id=${campuriText.id_utiliz} and rol!='admin'`;
        var comanda=`delete from utilizatori where id=$1 and rol !='admin' and nume!= $2::text `;
		client.query(comanda, [campuriText.id_utiliz,"Mihai"],  function(err, rez){
			// TO DO mesaj cu stergerea
            if(err)
                console.log(err);
            else{
                if (rez.rowCount>0){
                    console.log("sters cu succes");
                }
                else{
                    console.log("stergere esuata");
                }
            }
		});
	});
	}
	res.redirect("/useri");
	
});

app.get('/stergeProduse', function(req, res){
	
	if( req.session && req.session.utilizator && req.session.utilizator.rol=="admin" ){
        client.query("select * from prods",function(err, rezultat){
            if(err) throw err;
            res.render('pagini/stergeProduse',{produse:rezultat.rows});//afisez index-ul in acest caz
        });
	} 
    else{
		res.status(403).render('pagini/404',{mesaj:"Nu aveti acces"});
	}
    
});

app.post("/stergereProduse",function(req, res){
	if( req.session && req.session.utilizator && req.session.utilizator.rol=="admin"  ){
	var formular= new formidable.IncomingForm()
	
	formular.parse(req, function(err, campuriText, campuriFisier){
        var comanda=`delete from prods where id_prods = ${campuriText.id} `;
        
		client.query(comanda, function(err, rez){
			// TO DO mesaj cu stergerea
            if(err)
                console.log("plssssssssssssss" + err);
                
            else{
                if (rez.rowCount>0){
                    console.log("sters cu succes");
                }
                else{
                    console.log("stergere esuata");
                }
            }
		});
	});
	}
	res.redirect("/stergeProduse");
	
});

app.get('/modificaProduse', function(req, res){
	
	if( req.session && req.session.utilizator && req.session.utilizator.rol=="admin" ){
        client.query("select * from prods",function(err, rezultat){
            if(err) throw err;
            res.render('pagini/modificaProduse',{produse:rezultat.rows});//afisez index-ul in acest caz
        });
	} 
    else{
		res.status(403).render('pagini/404',{mesaj:"Nu aveti acces"});
	}
    
});

app.post("/modificareProduse", function(req,res) {
    var formular= new formidable.IncomingForm();
    formular.parse(req, function(err, campuriText, campuriFile){
        //verificari - TO DO
        var eroare="";

        if(!campuriText.id) {
            eroare += "Trebuie introdus un ID!";
        }

        if (!campuriText.nume && !campuriText.pret && !campuriText.calorii && !campuriText.greutate)
            eroare+=" Cel putin unul dintre randurile cu atribute trebuie completat!";

        
        //verificari proprii

        if (eroare == "") {
            var queryProdusUnic = `select * from prods where id_prods = '${campuriText.id}'`;
            client.query(queryProdusUnic, function(err,rez) {
                if (err) {
                    console.log (err);
                    res.render("pagini/managementProduse", {err: "Probleme la baza de date!"});
                    return;
                }
                if (rez.rows.length != 0){
                    if ( campuriText.nume )
                        var queryModificareProdus = `UPDATE prods set nume = '${campuriText.nume}', calorii = '${campuriText.calorii}', greutate = '${campuriText.greutate}', pret = '${campuriText.pret}' where id_prods = '${campuriText.id}'`;
                        console.log(queryModificareProdus);
                        client.query(queryModificareProdus, function(err,rez){
                        if (err) {
                            console.log(err);
                            res.render("pagini/managementProduse", {err: "Eroare la baza de date dupa prima faza!" + err});
                        }
                        else {
                            res.render("pagini/managementProduse", {err: "", raspuns: "Date introduse!"});
                        }
                    });
                }
                else {
                    
                    eroare += "Produsul cautat nu exista!";
                    res.redirect("/modificaProduse");
                }
            });
        }
        else {
            res.render("pagini/managementProduse",{err:eroare});
        }
    });
    res.redirect("/modificaProduse");
});

app.get("/*", function(req,res){
    
    res.render("pagini"+req.url, function(err, rezultatRender){
        if(err) {
            if (err.message.includes("Failed to lookup")) {
                res.render("pagini/404");
            }
            else
            {
                if(req.url.toString().includes(".ejs")) {
                    res.render("pagini/403");
                }
                else {
                    res.send(rezultatRender);
                }
            }
        }
        else
            res.send(rezultatRender);

    })
    
})

var s_port = process.env.PORT || 8081;
//app.listen(8080);
app.listen(s_port);

console.log("Serverul a pornit");
