// ─── Ethics page content — read-only student awareness guide ────────────────
// All body text for the #/ethics page lives here. The render module reads
// window.ETHICS_CONTENT, window.ETHICS_SELF_CHECK, window.ETHICS_SCENARIOS,
// window.ETHICS_MYTH_FACTS and window.ETHICS_SOURCES.
// No text is hardcoded in HTML or the router. No emojis.
// Each part carries a one-sentence summary (<= 20 words), a simple[] array of
// 3 lines for Simple mode, and a chip label.
// Topics have id, title, bullets. A bullet flagged takeaway: true renders as a
// "Key takeaway" block (at most one per topic, at most 10 topics across page).
window.ETHICS_CONTENT = [
{
  part: 1,
  shortName: 'Manners',
  partTitle: 'Manners, Behaviour and Civic Sense',
  summary: 'Everyday manners, classroom etiquette, civic sense and social respect for students.',
  simple: ['Be polite, listen, and say please, thank you, and sorry.', 'Keep your class, school, and streets clean and follow queues and traffic rules.', 'Treat everyone fairly and help people who need it.'],
  chip: 'Manners',
  topics: [
  { id: 1, title: 'Personal Etiquette and Good Manners', bullets: [
    'Greet people politely and use words such as please, thank you, excuse me, and sorry.',
    'Listen without interrupting others.',
    'Respect different opinions, even when you disagree.',
    'Be punctual and respect other people\'s time.',
    'Maintain personal hygiene and dress appropriately for the situation.',
    'Apologise sincerely when you make a mistake.',
    'Avoid abusive language, insulting jokes, and unnecessary arguments.',
    'Respect personal space and other people\'s belongings.'
  ] },
  { id: 2, title: 'Classroom Etiquette', bullets: [
    'Arrive on time and be prepared for class.',
    'Listen when teachers and classmates are speaking.',
    'Raise your hand or wait for an appropriate opportunity to speak.',
    'Ask questions when you do not understand something.',
    'Never ridicule someone for asking a question or making a mistake.',
    'Complete assignments honestly and on time.',
    'Keep classrooms clean and avoid damaging school property.',
    'Respect teachers, classmates, and all school staff.'
  ] },
  { id: 3, title: 'Civic Sense in Public Places', bullets: [
    'Put rubbish in dustbins and avoid littering.',
    'Stand in queues and wait for your turn.',
    'Follow traffic signals and cross roads at designated crossings.',
    'Wear helmets and seat belts as appropriate.',
    'Avoid unnecessary honking, shouting, and loud music in public.',
    'Keep public toilets, parks, buses, and other shared spaces clean.',
    'Do not damage public property or write on walls and monuments.',
    'Offer assistance to people who need it, while respecting their wishes.',
    'Follow public safety rules and instructions during emergencies.'
  ] },
  { id: 4, title: 'Environmental Responsibility', bullets: [
    'Save water and electricity.',
    'Avoid unnecessary single-use plastics where practical alternatives exist.',
    'Separate waste when facilities are available.',
    'Never throw rubbish from a moving vehicle.',
    'Protect trees, plants, and wildlife.',
    'Use reusable bottles and bags when possible.',
    'Keep neighbourhoods and school surroundings clean.',
    { text: 'Understand that environmental protection is a shared responsibility.', takeaway: true }
  ] },
  { id: 5, title: 'Social Behaviour and Mutual Respect', bullets: [
    'Treat people with dignity regardless of their background or financial circumstances.',
    'Avoid discrimination based on caste, religion, gender, disability, or other personal characteristics.',
    'Include classmates who are often left out.',
    'Do not spread rumours or deliberately humiliate others.',
    'Respect differences in interests, abilities, and opinions.',
    'Help people without expecting a reward.',
    'Stand against bullying safely and responsibly.',
    { text: 'Remember that respect should extend to everyone, not only people in positions of authority.', takeaway: true }
  ] }
  ]
},
{
  part: 2,
  shortName: 'Rights',
  partTitle: 'Human Rights, Children\'s Rights and Student Rights',
  summary: 'Fundamental rights, child rights under the Constitution, and student rights at school.',
  simple: ['Every person has rights, and every child deserves safety, dignity, and education.', 'Schools can make reasonable rules, but they cannot hit or humiliate you.', 'Your rights are not rewards. You also need to respect other people’s rights.'],
  chip: 'Rights',
  topics: [
  { id: 6, title: 'Basic Human Rights', bullets: [
    'Right to equality: Equal protection under the law and protection against prohibited discrimination.',
    'Right to life and personal liberty: Protection under Article 21 of the Indian Constitution.',
    'Freedom of speech and expression: The ability to express views subject to lawful restrictions.',
    'Freedom of religion: Constitutionally protected religious freedoms.',
    'Right against exploitation: Protection against trafficking, forced labour, and specified forms of child labour.',
    'Right to privacy: Protection of personal life and information under applicable law.',
    'Right to dignity: Every person deserves humane and respectful treatment.',
    'Right to justice: Access to legal remedies and fair procedures under applicable law.',
    'Right to constitutional remedies: The ability to approach appropriate courts to enforce fundamental rights.'
  ] },
  { id: 7, title: 'Children\'s Rights', bullets: [
    'Every child deserves protection, care, and opportunities to develop.',
    'Children have the right to a name and nationality under the UN Convention on the Rights of the Child.',
    'Children should be protected from physical, emotional, and sexual abuse.',
    'Children have the right to express their views on matters affecting them.',
    'Children\'s opinions should receive appropriate consideration according to their age and maturity.',
    'Children deserve opportunities for rest, play, and recreation.',
    'Children must be protected from unlawful exploitation and child marriage.',
    'Children deserve privacy, personal boundaries, and protection from discrimination.',
    'Children who cannot safely live with their families should receive appropriate care and protection.',
    'Children\'s best interests should be considered in decisions affecting them, in accordance with applicable law.'
  ] },
  { id: 8, title: 'Fundamental Rights Under the Indian Constitution', bullets: [
    'Article 14: Equality before the law and equal protection of the laws.',
    'Article 15: Prohibition of specified forms of discrimination.',
    'Article 17: Abolition of untouchability.',
    'Article 19: Certain freedoms, including speech and expression, subject to constitutional restrictions.',
    'Article 21: Protection of life and personal liberty.',
    'Article 21A: Free and compulsory education for children aged 6鈥�14.',
    'Article 23: Prohibition of trafficking and forced labour.',
    'Article 24: Prohibition of employing children below 14 in factories, mines, and other hazardous employment covered by the provision.',
    'Article 32: Right to approach the Supreme Court to enforce fundamental rights.',
    'Students should understand that the Constitution protects rights through specific provisions and that their precise application depends on the circumstances.'
  ] },
  { id: 9, title: 'Student Rights at School', bullets: [
    'Students deserve dignity and protection from abuse and unlawful discrimination.',
    'Children covered by Section 17 of the Right to Education Act, 2009, are protected against physical punishment and mental harassment.',
    'Students can ask questions and respectfully seek clarification.',
    'Students can report bullying, harassment, and unsafe conditions.',
    'Parents can request explanations of school fees and applicable policies.',
    'Students should know relevant attendance, assessment, examination, and promotion requirements.',
    'Students can raise grievances through appropriate channels.',
    'Schools must comply with applicable laws and education-board requirements.',
    'Students must also respect the rights, safety, and dignity of classmates and staff.'
  ] },
  { id: 10, title: 'School Rules, Authority and Unfair Practices', bullets: [
    'A school rule is not automatically lawful simply because the school has announced it.',
    'Not every unpopular or inconvenient rule is illegal.',
    'Schools can establish reasonable rules regarding attendance, uniforms, homework, examinations, and discipline.',
    'Physical punishment and prohibited mental harassment cannot be justified as discipline.',
    'Humiliating students over marks or family finances raises serious concerns about dignity and fair treatment.',
    'Parents can request a written explanation of unclear fees or compulsory purchases.',
    'Students should ask which written policy or legal requirement applies to a disputed decision.',
    'Fee, attendance, and examination disputes must be assessed according to the applicable rules.',
    'Record relevant facts and use appropriate complaint procedures instead of relying on rumours.'
  ] },
  { id: 11, title: 'Rights and Responsibilities', bullets: [
    'Right to education: Attend, participate, and respect others\' opportunity to learn.',
    'Right to equality: Treat others fairly and avoid discrimination.',
    'Right to expression: Share views respectfully and listen to others.',
    'Right to privacy: Protect other people\'s private information.',
    'Right to safety: Avoid harming others and report dangerous situations.',
    'Right to recreation: Participate fairly and safely in shared activities.',
    'Right to dignity: Do not bully, threaten, or humiliate others.',
    'Right to public services: Use shared facilities responsibly.',
    { text: 'A child\'s basic rights are not rewards for good behaviour. Rights and responsibilities are related, but a child does not lose protection from abuse because they have misbehaved.', takeaway: true }
  ] }
  ]
},
{
  part: 3,
  shortName: 'Safety',
  partTitle: 'Safety, Bullying and Personal Boundaries',
  summary: 'Bullying prevention, personal body safety, boundaries, and emergency awareness for students.',
  simple: ['Bullying is hurting, scaring, or leaving someone out on purpose.', 'You can say no to unwanted touch and to sharing private photos.', 'If you feel unsafe, go to a safe place and tell a trusted adult.'],
  chip: 'Safety',
  topics: [
  { id: 12, title: 'Bullying and Harassment', bullets: [
    'Physical bullying: Hitting, pushing, or damaging belongings.',
    'Verbal bullying: Insults, threats, or repeated name-calling.',
    'Social bullying: Deliberate exclusion or public humiliation.',
    'Cyberbullying: Threatening or harassing someone through digital platforms.',
    'Discriminatory harassment: Targeting someone because of their identity or background.',
    'Avoid retaliating or escalating a conflict.',
    'Tell a trusted adult or appropriate authority when behaviour is harmful.',
    'Preserve relevant evidence if it is safe to do so.',
    'Support affected students without putting yourself in danger.',
    'Do not participate by laughing at, recording, or sharing humiliating content.'
  ] },
  { id: 13, title: 'Personal Safety and Body Boundaries', bullets: [
    'Everyone deserves personal boundaries and protection from abuse.',
    'You can refuse unwanted physical contact and seek help.',
    'Do not allow anyone to pressure you into sharing private photographs or information.',
    'No one should use threats or manipulation to make you keep abuse secret.',
    'Move towards a safe place if you feel threatened.',
    'Contact a trusted adult if someone makes you feel unsafe.',
    'Do not confront an abusive person alone if doing so could put you at risk.',
    { text: 'Remember that responsibility for abuse lies with the person committing it, not the child experiencing it.', takeaway: true }
  ] },
  { id: 14, title: 'Emergency Awareness and First Aid', bullets: [
    'Know how to contact emergency services.',
    'Learn your school\'s evacuation routes and assembly points.',
    'Know where first-aid supplies are kept.',
    'Report accidents to a responsible adult.',
    'Do not crowd around an injured person.',
    'Avoid moving someone with a suspected serious injury unless immediate danger makes it necessary.',
    'Never touch unidentified chemicals, exposed electrical wires, or suspicious objects.',
    'Do not share prescription medicines with classmates.',
    'Follow instructions from trained emergency responders.',
    'Learn practical first aid from qualified instructors.'
  ] }
  ]
},
{
  part: 4,
  shortName: 'Digital',
  partTitle: 'Digital Citizenship and Information Literacy',
  summary: 'Digital etiquette, cyber safety, spotting misinformation, and responsible AI use.',
  simple: ['Never share your OTP, PIN, or passwords.', 'Check if news is true before you forward it.', 'AI can be wrong. Check important facts and give credit for other people’s work.'],
  chip: 'Digital',
  topics: [
  { id: 15, title: 'Digital Etiquette and Cyber Safety', bullets: [
    'Use strong, unique passwords and keep OTPs and PINs private.',
    'Think before posting, commenting, or sharing.',
    'Do not share other people\'s photographs or private messages without appropriate permission.',
    'Avoid cyberbullying, impersonation, and abusive comments.',
    'Be cautious of suspicious links, unexpected prizes, and urgent payment requests.',
    'Never share banking credentials with strangers.',
    'Report threats, blackmail, and fraudulent activity to a trusted adult and appropriate authority.',
    { text: 'Remember that online actions can have real-world consequences.', takeaway: true }
  ] },
  { id: 16, title: 'Misinformation and Critical Thinking', bullets: [
    'Verify information before forwarding it.',
    'Check the source, date, and supporting evidence.',
    'Distinguish facts from opinions and assumptions.',
    'Compare important claims with reliable sources.',
    'Do not assume a viral message is true because many people shared it.',
    'Consider whether relevant context has been omitted.',
    'Be willing to change your opinion when reliable evidence contradicts it.',
    'Avoid making public accusations without adequate evidence.'
  ] },
  { id: 17, title: 'Artificial Intelligence, Copyright and Academic Honesty', bullets: [
    'AI-generated information can be incorrect even when it sounds convincing.',
    'Verify important facts using reliable sources.',
    'Follow school rules regarding AI-assisted assignments.',
    'Do not submit copied work as your own.',
    'Give appropriate credit to original creators.',
    'Understand plagiarism, quotation, paraphrasing, and citation.',
    'Do not use AI to impersonate someone or create material intended to harm them.',
    'Protect personal and confidential information when using online tools.'
  ] }
  ]
},
{
  part: 5,
  shortName: 'Wellbeing',
  partTitle: 'Health, Mental Well-being and Relationships',
  summary: 'Mental health awareness, consent, privacy, and gender equality for students.',
  simple: ['Your feelings matter as much as your marks.', 'Asking for help is a responsible thing to do.', 'Respect everyone’s boundaries and treat everyone equally.'],
  chip: 'Wellbeing',
  topics: [
  { id: 18, title: 'Mental Health and Emotional Intelligence', bullets: [
    'Emotional well-being matters alongside academic achievement.',
    { text: 'Asking for help is a responsible action, not a weakness.', takeaway: true },
    'One examination result does not determine your worth or entire future.',
    'Communicate feelings respectfully.',
    'Learn to manage disagreements without insults or threats.',
    'Set healthy boundaries in friendships.',
    'Seek support when persistent distress affects daily life.',
    'Do not shame others for seeking mental health care.',
    'Maintain sustainable routines for sleep, study, recreation, and physical activity.',
    'Focus on learning from mistakes instead of demanding perfection.'
  ] },
  { id: 19, title: 'Consent, Privacy and Personal Boundaries', bullets: [
    'Ask before borrowing another person\'s belongings.',
    'Respect another person\'s decision to decline an activity.',
    'Do not pressure others to disclose private information.',
    'Ask permission before sharing personal photographs or messages.',
    'Permission for one activity does not automatically mean permission for another.',
    'Respect physical and emotional boundaries.',
    'Seek help when someone uses threats or manipulation to override another person\'s wishes.'
  ] },
  { id: 20, title: 'Gender Equality and Inclusion', bullets: [
    'Everyone deserves equal dignity and educational opportunities.',
    'Do not assign abilities, interests, or careers according to gender stereotypes.',
    'Do not excuse harassment as a joke.',
    'Respect differences in culture, identity, abilities, and personal interests.',
    'Challenge discriminatory behaviour safely and respectfully.',
    'Recognise that some students need reasonable accommodations to access equal opportunities.',
    'Treat people fairly rather than assuming everyone has identical needs.'
  ] }
  ]
},
{
  part: 6,
  shortName: 'Money and Skills',
  partTitle: 'Financial Literacy and Practical Life Skills',
  summary: 'Basic money management, saving habits, and essential practical skills for students.',
  simple: ['Know the difference between needs and wants, and try to save a little.', 'If an offer sounds too good to be true, check it before you trust it.', 'Learn to communicate, plan your time, and ask for help when you need it.'],
  chip: 'Money and Skills',
  topics: [
  { id: 21, title: 'Financial Literacy', bullets: [
    'Distinguish needs from wants.',
    'Learn to prepare a basic budget.',
    'Understand income, expenses, savings, and debt.',
    'Save money for planned needs and unexpected expenses.',
    'Learn how bank accounts and digital payments work.',
    'Never share banking passwords, PINs, or OTPs.',
    'Verify online offers before paying.',
    'Be cautious of guaranteed-return promises and quick-money schemes.',
    'Understand that borrowing money creates repayment obligations.',
    'Ask a trusted adult for help when a financial transaction seems suspicious.'
  ] },
  { id: 22, title: 'Practical Life Skills', bullets: [
    'Communication: Express ideas clearly and respectfully.',
    'Time management: Balance learning, rest, and responsibilities.',
    'Decision-making: Consider choices, evidence, and consequences.',
    'Problem-solving: Break difficult situations into manageable steps.',
    'Cooking: Learn basic food preparation and kitchen safety.',
    'Personal care: Maintain hygiene and recognise basic health needs.',
    'Teamwork: Cooperate and resolve differences constructively.',
    'Public speaking: Communicate ideas with clarity and confidence.',
    'Self-advocacy: Explain your needs and seek appropriate support.',
    'Accountability: Acknowledge mistakes and take steps to correct them.'
  ] }
  ]
},
{
  part: 7,
  shortName: 'Civic and Law',
  partTitle: 'Civic and Legal Awareness',
  summary: 'Understanding government, the law, complaint mechanisms, and where to get help.',
  simple: ['The Constitution and laws protect people, and they apply to authorities too.', 'Know who does what: police, courts, and government offices.', 'Protect public property, follow traffic rules, and say no to bribery.'],
  chip: 'Civic and Law',
  topics: [
  { id: 23, title: 'Understanding Government and the Law', bullets: [
    'Learn the basic purpose of the Indian Constitution.',
    'Understand the roles of Parliament, state legislatures, courts, and local government.',
    'Know the difference between police, courts, and government departments.',
    'Understand that public authorities must act within their lawful powers.',
    'Learn how to report public safety concerns.',
    'Protect public property and use public services responsibly.',
    'Follow traffic laws.',
    'Understand why bribery, fraud, and corruption harm society.',
    'Learn how elections work and why eligible citizens should participate.',
    { text: 'Recognise that allegations require evidence and that legal questions depend on specific circumstances.', takeaway: true }
  ] },
  { id: 24, title: 'Complaint Mechanisms and Sources of Help in India', bullets: [
    'Child Helpline 鈥� 1098: For children needing care and protection.',
    'Emergency Response 鈥� 112: For immediate emergencies.',
    'NCPCR: For relevant children\'s rights complaints at the national level.',
    'State Commission for Protection of Child Rights: For relevant complaints within its jurisdiction.',
    'Education authorities: For applicable school and education grievances.',
    'Police or Special Juvenile Police Units: For offences and serious safety concerns.',
    'Child Welfare Committee: For children requiring care and protection under the relevant law.',
    'Trusted adults: Parents, guardians, counsellors, or responsible adults who can help access support.',
    'When reporting a problem, describe what happened accurately, record relevant dates and evidence when safe, and explain what assistance is needed.'
  ] }
  ]
},
{
  part: 8,
  shortName: 'Character',
  partTitle: 'Character and Personal Responsibility',
  summary: 'Personal discipline, distinguishing respect from blind obedience, and ten golden principles.',
  simple: ['Do the right thing even when nobody is watching.', 'Be honest about mistakes and learn from them.', 'Respect people, but think for yourself and ask when something seems unsafe or unfair.'],
  chip: 'Character',
  topics: [
  { id: 25, title: 'Personal Discipline and Accountability', bullets: [
    'Follow reasonable rules even when nobody is watching.',
    'Be honest about mistakes.',
    'Return lost property to its owner or an appropriate authority.',
    'Keep promises when possible and communicate when you cannot.',
    'Take care of shared resources.',
    'Avoid blaming others for every problem.',
    'Learn from feedback without accepting humiliation or abuse.',
    'Consider the consequences of your actions.',
    'Make decisions based on evidence and sound judgement.',
    'Keep improving rather than expecting perfection.'
  ] },
  { id: 26, title: 'The Difference Between Respect, Fear and Blind Obedience', bullets: [
    'Respect: Treating others with dignity while maintaining your own boundaries.',
    'Fear: Acting mainly to avoid punishment or intimidation.',
    'Blind obedience: Following instructions without considering whether they are safe, reasonable, or lawful.',
    'Respect teachers and parents, but understand that everyone can make mistakes.',
    'Ask for clarification when an instruction is confusing.',
    'Seek help when an instruction appears unsafe or unlawful.',
    'Disagree calmly rather than becoming abusive.',
    'Evaluate authority through evidence, conduct, and applicable rules.'
  ] },
  { id: 27, title: 'Ten Golden Principles Every Student Should Remember', bullets: [
    'Respect yourself and other people.',
    'Know your rights and understand your responsibilities.',
    'Think critically instead of believing every claim.',
    'Never bully, exploit, or discriminate against others.',
    'Protect your personal information and boundaries.',
    'Follow reasonable rules and question unfair treatment appropriately.',
    'Seek help when you face abuse, exploitation, or danger.',
    'Take responsibility for your mistakes.',
    'Use public resources and digital platforms responsibly.',
    'Treat education as preparation for life, not merely as a way to pass examinations.'
  ] }
  ]
},
{
  part: 9,
  shortName: 'Help',
  partTitle: 'Where to Seek Help and Everyday Habits',
  summary: 'Helplines, complaint authorities, school rules, everyday habits, and golden rules.',
  simple: ['Call 1098 for a child who needs care or protection, and 112 in an emergency.', 'Tell a trusted adult, a counsellor, or the police.', 'Asking for help is never disobedience.'],
  chip: 'Help',
  topics: [
  { id: 28, title: 'Where Children Can Seek Help in India', bullets: [
    'Child Helpline 1098: for children who need care, protection, or assistance, including abuse, neglect, exploitation, child marriage, or unsafe situations. A concerned person can also report a child who may need protection.',
    'Emergency Response 112: India\'s emergency number, for immediate danger or urgent police, fire, or medical help.',
    'NCPCR: protects and promotes children\'s rights, and receives complaints about violations of children\'s rights, including safety, education, abuse, and exploitation.',
    'State Commission for Protection of Child Rights: works at the state level and can examine complaints involving schools, child protection, and other rights violations within its jurisdiction.',
    'Right to Education authorities: children and parents can raise concerns about violations of education rights; the right authority depends on the issue and the state.',
    'Police and Special Juvenile Police Units: for violence, abuse, exploitation, trafficking, or other offences involving children.',
    'Child Welfare Committee: a statutory body that can arrange care, protection, and rehabilitation for children in cases of abuse, abandonment, exploitation, or unsafe living conditions.',
    'Trusted adults and school authorities: parents or guardians, a trusted teacher, a school counsellor, the principal or school management (if approaching them is safe), or another responsible adult.',
    'If the person causing harm is a teacher, principal, or family member, seek help from an independent trusted adult or the relevant authority.'
  ] },
  { id: 29, title: 'What To Do If Your Rights Are Violated', bullets: [
    'Recognise the problem: abuse, exploitation, and unlawful discrimination are serious matters.',
    'Seek help: tell a trusted adult or contact an appropriate helpline.',
    'Record relevant facts: if it is safe, note what happened and keep relevant messages or documents.',
    'Report the issue: contact the appropriate authority, especially if it continues or involves serious harm.',
    'Prioritise safety: do not confront an abusive person alone or put yourself at further risk.',
    { text: 'Asking for help is not disobedience. Every child deserves safety, dignity, education, and protection.', takeaway: true }
  ] },
  { id: 30, title: 'Questions You Can Ask About a School Rule or Decision', bullets: [
    'What is the written rule behind this decision?',
    'What is the reason for this requirement?',
    'Is there an appeal or complaint process?',
    'What does the applicable law say?',
    'Who can help me resolve this fairly?',
    'Ask respectfully and support your questions with facts.'
  ] },
  { id: 31, title: 'Everyday Situations: What To Do', table: { headers: ['Situation', 'The right thing to do'], rows: [['You see someone littering', 'Politely encourage them to use a dustbin, if safe.'], ['You accidentally hurt someone', 'Apologise sincerely.'], ['Someone is being bullied', 'Support them safely and inform a trusted adult.'], ['You find a lost wallet', 'Hand it to the appropriate authority.'], ['You are standing in a queue', 'Wait for your turn.'], ['You see a running tap', 'Turn it off if safe and appropriate.'], ['You disagree with a teacher or classmate', 'Express your opinion respectfully.'], ['You receive an unverified message', 'Verify it before sharing.'], ['You damage public property accidentally', 'Report it to the appropriate authority.'], ['You see someone who needs help', 'Offer assistance while considering safety.']] } },
  { id: 32, title: 'Ten Golden Rules of Civic Sense', bullets: [
    'Keep yourself and your surroundings clean.',
    'Respect people, not just positions.',
    'Follow rules even when nobody is watching.',
    'Never damage what belongs to everyone.',
    'Respect queues and other people\'s time.',
    'Use public resources responsibly.',
    'Be kind to people and animals.',
    'Think before you speak, act, or post online.',
    'Take responsibility for your mistakes.',
    'Leave every place a little better than you found it.'
  ] }
  ]
}
];

window.ETHICS_SELF_CHECK = [
  'I treated people respectfully.',
  'I followed reasonable rules and fulfilled my responsibilities.',
  'I avoided bullying and discrimination.',
  'I used technology responsibly.',
  'I checked important information before sharing it.',
  'I respected privacy and personal boundaries.',
  'I took care of my health and daily responsibilities.',
  'I admitted or corrected a mistake when necessary.',
  'I contributed positively to my surroundings.',
  'I learned something useful beyond my textbooks.'
];

window.ETHICS_SCENARIOS = [
  {
    "id": 1,
    "situation": "A classmate's private photo has been shared in your class group chat, and people are laughing.",
    "options": [
      {
        "text": "Laugh along so people do not target you.",
        "best": false,
        "why": "Laughing adds to the harm, and the person in the photo is being humiliated."
      },
      {
        "text": "Do not share it, tell your classmates it is not okay, and tell a trusted adult.",
        "best": true,
        "why": "Not sharing and speaking up safely protects the person and stops the spread. A trusted adult can help get it removed."
      },
      {
        "text": "Forward it to one friend to ask if it is real.",
        "best": false,
        "why": "Forwarding spreads the photo further and makes you part of the problem."
      }
    ],
    "topicId": 19
  },
  {
    "id": 2,
    "situation": "A message says you won a free phone and asks you to enter your bank details and an OTP to claim it.",
    "options": [
      {
        "text": "Enter the details quickly before the offer ends.",
        "best": false,
        "why": "Urgent prizes asking for OTPs are a common scam. Sharing an OTP can empty a bank account."
      },
      {
        "text": "Ask a friend whether it is real and then enter the details if they say yes.",
        "best": false,
        "why": "A friend cannot make a scam safe. Never share OTPs or bank details with anyone who contacts you."
      },
      {
        "text": "Do not share anything, do not click, and show it to a trusted adult.",
        "best": true,
        "why": "Never share OTPs, PINs, or banking details. A trusted adult can help report it."
      }
    ],
    "topicId": 15
  },
  {
    "id": 3,
    "situation": "A teacher shouts at a student in front of the whole class and calls them stupid because of low marks.",
    "options": [
      {
        "text": "Join in with a joke so the teacher likes you.",
        "best": false,
        "why": "Humiliation is not discipline, and joining in hurts your classmate."
      },
      {
        "text": "Stay quiet, and later check on the student and encourage them to talk to a trusted adult.",
        "best": true,
        "why": "Support the student without escalating in the moment, and help them reach someone who can raise it properly."
      },
      {
        "text": "Record the teacher and post it online.",
        "best": false,
        "why": "Posting can create new risks and does not use a proper complaint process. Note what happened and use appropriate channels."
      }
    ],
    "topicId": 10
  },
  {
    "id": 4,
    "situation": "Your friend says a viral post claims your school’s new rule is illegal and wants everyone to share it.",
    "options": [
      {
        "text": "Share it immediately because many people already did.",
        "best": false,
        "why": "Many shares do not make a claim true."
      },
      {
        "text": "Check the original source and the actual rule or law before sharing.",
        "best": true,
        "why": "Verify first. Some rules are unfair but not illegal, and some may be unlawful, so check evidence."
      },
      {
        "text": "Share it but add 'not sure if true'.",
        "best": false,
        "why": "A caveat still spreads a claim that may be false."
      }
    ],
    "topicId": 16
  },
  {
    "id": 5,
    "situation": "A student in your class is always left out at lunch and sits alone.",
    "options": [
      {
        "text": "Ignore it. It is not your problem.",
        "best": false,
        "why": "Small acts of inclusion matter, and exclusion can hurt a lot over time."
      },
      {
        "text": "Invite them to sit with you or join your group, and be kind.",
        "best": true,
        "why": "Including classmates who are often left out is a simple, safe way to help."
      },
      {
        "text": "Make fun of them with your friends.",
        "best": false,
        "why": "This is social bullying and makes things worse."
      }
    ],
    "topicId": 5
  },
  {
    "id": 6,
    "situation": "Someone older than you asks you to keep a secret that makes you uncomfortable and says you will get in trouble if you tell.",
    "options": [
      {
        "text": "Keep the secret because they said so.",
        "best": false,
        "why": "You should never be pressured to keep something that makes you feel unsafe, and it is never your fault."
      },
      {
        "text": "Move to a safe place, tell a trusted adult, and call 1098 if you need to.",
        "best": true,
        "why": "Threats or pressure to keep a secret are a warning sign. Tell a trusted adult, and use 1098 if you need help reaching someone."
      },
      {
        "text": "Confront them alone to tell them to stop.",
        "best": false,
        "why": "Do not confront someone alone if it could put you at risk. Get help."
      }
    ],
    "topicId": 13
  },
  {
    "id": 7,
    "situation": "You find a wallet with money and an ID card in the school corridor.",
    "options": [
      {
        "text": "Keep the money and throw the wallet away.",
        "best": false,
        "why": "This is taking what is not yours."
      },
      {
        "text": "Hand it to a teacher or the school office so it can reach its owner.",
        "best": true,
        "why": "Returning lost property to the owner or the proper authority is the right thing to do."
      },
      {
        "text": "Leave it where it is.",
        "best": false,
        "why": "It could get lost or stolen. Handing it in is better."
      }
    ],
    "topicId": 25
  },
  {
    "id": 8,
    "situation": "You accidentally break a window while playing and nobody saw it.",
    "options": [
      {
        "text": "Say nothing and hope nobody finds out.",
        "best": false,
        "why": "Hiding it avoids responsibility and can lead to wrong people being blamed."
      },
      {
        "text": "Tell a teacher what happened and offer to follow the school’s process for fixing it.",
        "best": true,
        "why": "Taking responsibility is the right thing, and a fair process can deal with it."
      },
      {
        "text": "Blame a classmate who is not popular.",
        "best": false,
        "why": "Blaming someone else is unfair and harms them."
      }
    ],
    "topicId": 25
  },
  {
    "id": 9,
    "situation": "Exams are close, and a friend says they will send you the answers during the test.",
    "options": [
      {
        "text": "Accept, since everyone does it.",
        "best": false,
        "why": "Cheating is dishonest, and others’ honest work is harmed. Not everyone does it."
      },
      {
        "text": "Say no politely, and focus on your own preparation.",
        "best": true,
        "why": "Not cheating and not encouraging cheating is part of academic honesty."
      },
      {
        "text": "Take the answers but do not copy all of them.",
        "best": false,
        "why": "Any copying is still cheating."
      }
    ],
    "topicId": 2
  },
  {
    "id": 10,
    "situation": "You feel very stressed about an upcoming result and keep thinking your whole future depends on it.",
    "options": [
      {
        "text": "Keep it to yourself and study through the night.",
        "best": false,
        "why": "Rest and sleep support learning, and keeping it all inside makes stress heavier."
      },
      {
        "text": "Talk to a parent, a trusted teacher, or the school counsellor, and keep a steady study routine.",
        "best": true,
        "why": "One result does not define your worth. Asking for help is a responsible action, not weakness."
      },
      {
        "text": "Compare your marks with everyone else’s all week.",
        "best": false,
        "why": "Constant comparison distracts you from your own progress."
      }
    ],
    "topicId": 18
  }
];

window.ETHICS_MYTH_FACTS = [
  {
    "id": 1,
    "statement": "If a school announces a rule, it is automatically legal.",
    "answer": "myth",
    "explanation": "A school rule must follow applicable laws. Many rules are reasonable, but being announced does not make a rule lawful."
  },
  {
    "id": 2,
    "statement": "Every rule you dislike is illegal.",
    "answer": "myth",
    "explanation": "Not every unpopular or inconvenient rule is illegal. Schools can set reasonable rules about attendance, uniforms, homework, examinations, and discipline."
  },
  {
    "id": 3,
    "statement": "Children covered by the Right to Education Act are protected from physical punishment and mental harassment in school.",
    "answer": "fact",
    "explanation": "Section 17 of the Right to Education Act, 2009 protects children it covers against physical punishment and mental harassment."
  },
  {
    "id": 4,
    "statement": "Low marks show that a student is not intelligent or has no future.",
    "answer": "myth",
    "explanation": "One result gives information about performance at one time. It does not measure your worth, your intelligence, or your whole future."
  },
  {
    "id": 5,
    "statement": "A message is true if many people have shared it.",
    "answer": "myth",
    "explanation": "Popularity is not evidence. Check the source, the date, and supporting evidence before sharing."
  },
  {
    "id": 6,
    "statement": "Asking for help with a serious problem is disobedience.",
    "answer": "myth",
    "explanation": "Asking for help is a sensible and responsible step. Every child deserves safety, dignity, education, and protection."
  },
  {
    "id": 7,
    "statement": "If an adult or authority figure behaves badly, it is acceptable because of who they are.",
    "answer": "myth",
    "explanation": "Inappropriate behaviour is not acceptable just because the person is an adult, a teacher, a relative, or an authority figure."
  },
  {
    "id": 8,
    "statement": "A child who has misbehaved loses protection from abuse.",
    "answer": "myth",
    "explanation": "A child’s basic rights are not rewards for good behaviour. Misbehaviour never makes abuse acceptable."
  }
];

window.ETHICS_SOURCES = [
  {
    "name": "Constitution of India (Articles 14, 15, 17, 19, 21, 21A, 23, 24, 32)",
    "purpose": "Fundamental rights and duties under the Constitution of India.",
    "url": "https://indiacode.nic.in/"
  },
  {
    "name": "Right to Education Act, 2009 (including Section 17)",
    "purpose": "The Act governing free and compulsory education and protection from physical punishment and mental harassment.",
    "url": "https://indiacode.nic.in/"
  },
  {
    "name": "National Commission for Protection of Child Rights",
    "purpose": "Protects and promotes child rights and receives complaints of violations.",
    "url": "https://ncpcr.gov.in"
  },
  {
    "name": "Ministry of Education",
    "purpose": "Government education policies and programmes.",
    "url": "https://education.gov.in"
  },
  {
    "name": "National Cyber Crime Reporting Portal",
    "purpose": "Report cyber crimes online.",
    "url": "https://cybercrime.gov.in"
  }
];
