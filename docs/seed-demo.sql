-- Reviren demo data (fake). Safe to run on an empty local database after migrations.
-- Creates a "Linear Algebra for Machine Learning" roadmap, a second small roadmap,
-- one study session with subtasks, flashcards and a Feynman review.

DO $$
DECLARE
  r1 uuid := gen_random_uuid();
  r2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  p3 uuid := gen_random_uuid();
  q1 uuid := gen_random_uuid();
  q2 uuid := gen_random_uuid();
  s_vec uuid := gen_random_uuid();
  s_sys uuid := gen_random_uuid();
  s_py  uuid := gen_random_uuid();
  s_eig uuid := gen_random_uuid();
  s_dec uuid := gen_random_uuid();
  s_opt uuid := gen_random_uuid();
  s_pca uuid := gen_random_uuid();
  s_nn  uuid := gen_random_uuid();
  s_pd  uuid := gen_random_uuid();
  s_viz uuid := gen_random_uuid();
  t_vectors uuid := gen_random_uuid();
  t_matrices uuid := gen_random_uuid();
  t_lintrans uuid := gen_random_uuid();
  t_dot uuid := gen_random_uuid();
  t_gauss uuid := gen_random_uuid();
  t_inverse uuid := gen_random_uuid();
  t_rank uuid := gen_random_uuid();
  t_numpy uuid := gen_random_uuid();
  t_broadcast uuid := gen_random_uuid();
  t_det uuid := gen_random_uuid();
  t_eigen uuid := gen_random_uuid();
  t_basis uuid := gen_random_uuid();
  sess uuid := gen_random_uuid();
  st1 uuid := gen_random_uuid();
  st2 uuid := gen_random_uuid();
  st3 uuid := gen_random_uuid();
  vid_3b1b jsonb := '[{"title":"Essence of Linear Algebra (3Blue1Brown)","url":"https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab","type":"video","purpose":"theory"}]';
  mit jsonb := '[{"title":"MIT 18.06 Linear Algebra (OpenCourseWare)","url":"https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/","type":"course","purpose":"theory"}]';
  numpy_docs jsonb := '[{"title":"NumPy: the absolute basics for beginners","url":"https://numpy.org/doc/stable/user/absolute_beginners.html","type":"documentation","purpose":"theory"}]';
  mml jsonb := '[{"title":"Mathematics for Machine Learning (free book)","url":"https://mml-book.github.io/","type":"book","purpose":"theory"}]';
BEGIN
  INSERT INTO roadmaps (id, title, description, created_at) VALUES
    (r1, 'Linear Algebra for Machine Learning',
     'From vectors and matrices to eigenvalues, SVD and PCA, with NumPy practice along the way. Aimed at about 6 hours per week.',
     now() - interval '20 days'),
    (r2, 'Data Analysis with Python',
     'pandas, plotting and basic statistics for working with real datasets.',
     now() - interval '9 days');

  INSERT INTO roadmap_phases (id, roadmap_id, title, "order") VALUES
    (p1, r1, 'Phase 1: Foundations (Weeks 1–3)', 0),
    (p2, r1, 'Phase 2: Core Theory (Weeks 4–7)', 1),
    (p3, r1, 'Phase 3: Applications in ML (Weeks 8–10)', 2),
    (q1, r2, 'Phase 1: Working with Data (Weeks 1–2)', 0),
    (q2, r2, 'Phase 2: Visualisation (Weeks 3–4)', 1);

  INSERT INTO sections (id, phase_id, title, description, "order") VALUES
    (s_vec, p1, 'Vectors and Matrices', NULL, 0),
    (s_sys, p1, 'Linear Systems', NULL, 1),
    (s_py,  p1, 'NumPy', NULL, 2),
    (s_eig, p2, 'Eigenvalues and Eigenvectors', NULL, 0),
    (s_dec, p2, 'Matrix Decompositions', NULL, 1),
    (s_opt, p2, 'Vector Calculus', NULL, 2),
    (s_pca, p3, 'Dimensionality Reduction', NULL, 0),
    (s_nn,  p3, 'Neural Network Math', NULL, 1),
    (s_pd,  q1, 'pandas', NULL, 0),
    (s_viz, q2, 'Matplotlib and Seaborn', NULL, 0);

  INSERT INTO topics (id, section_id, title, description, resources, "order", progress, is_completed) VALUES
    (t_vectors,  s_vec, 'Vectors', 'Vector addition, scaling, norms and geometric intuition. Every data point in ML is a vector.', vid_3b1b, 0, 100, true),
    (t_matrices, s_vec, 'Matrices', 'Matrix multiplication, transpose and identity. Matrices store datasets and model weights.', vid_3b1b, 1, 80, false),
    (t_lintrans, s_vec, 'Linear Transformations', 'Matrices as functions that rotate, scale and shear space.', vid_3b1b, 2, 60, false),
    (t_dot,      s_vec, 'Dot Product and Projections', 'Dot product, angles, orthogonality and projections. Used in similarity search and regression.', mit, 3, 30, false),
    (t_gauss,    s_sys, 'Gaussian Elimination', 'Row reduction, pivots and echelon form for solving Ax = b.', mit, 0, 100, true),
    (t_inverse,  s_sys, 'Matrix Inverse', 'When a matrix is invertible and how to compute the inverse.', mit, 1, 40, false),
    (t_rank,     s_sys, 'Rank and Null Space', 'Column space, null space and rank. Explains when systems have unique solutions.', mit, 2, 0, false),
    (t_numpy,    s_py,  'Arrays and Operations', 'Creating arrays, indexing, slicing and element-wise maths in NumPy.', numpy_docs, 0, 70, false),
    (t_broadcast,s_py,  'Broadcasting and Vectorisation', 'How NumPy applies operations across shapes without Python loops.', numpy_docs, 1, 20, false),
    (t_det,      s_eig, 'Determinants', 'Determinant as a volume scaling factor; link to invertibility.', vid_3b1b, 0, 0, false),
    (t_eigen,    s_eig, 'Eigenvalues', 'Characteristic polynomial, eigenvectors and diagonalisation.', vid_3b1b, 1, 0, false),
    (t_basis,    s_eig, 'Change of Basis', 'Representing the same vector in different coordinate systems.', vid_3b1b, 2, 0, false);

  INSERT INTO topics (section_id, title, description, resources, "order") VALUES
    (s_dec, 'LU Decomposition', 'Factoring a matrix into lower and upper triangular parts.', mit, 0),
    (s_dec, 'QR Decomposition', 'Gram-Schmidt and orthonormal bases.', mit, 1),
    (s_dec, 'Singular Value Decomposition', 'SVD as rotation, scaling, rotation. The core of PCA and recommender systems.', mml, 2),
    (s_opt, 'Partial Derivatives', 'Derivatives of multivariable functions.', mml, 0),
    (s_opt, 'Gradients', 'Gradient vectors and the direction of steepest ascent.', mml, 1),
    (s_opt, 'Jacobian and Hessian', 'Matrices of first and second derivatives.', mml, 2),
    (s_pca, 'Principal Component Analysis', 'Finding directions of maximum variance using eigenvectors of the covariance matrix.', mml, 0),
    (s_pca, 'Low-Rank Approximation', 'Compressing data by keeping the largest singular values.', mml, 1),
    (s_nn,  'Forward Pass as Matrix Products', 'Layers as matrix multiplications plus non-linearities.', mml, 0),
    (s_nn,  'Backpropagation', 'Chain rule applied to vectors and matrices.', mml, 1),
    (s_pd,  'DataFrames', 'Loading CSV files, selecting columns and filtering rows.', '[{"title":"pandas Getting Started","url":"https://pandas.pydata.org/docs/getting_started/index.html","type":"documentation","purpose":"theory"}]', 0),
    (s_pd,  'Grouping and Aggregation', 'groupby, pivot tables and summary statistics.', '[{"title":"pandas Getting Started","url":"https://pandas.pydata.org/docs/getting_started/index.html","type":"documentation","purpose":"theory"}]', 1),
    (s_viz, 'Line and Bar Charts', 'Choosing a chart for the question you are asking.', '[{"title":"Matplotlib Tutorials","url":"https://matplotlib.org/stable/tutorials/index.html","type":"documentation","purpose":"theory"}]', 0);

  -- One 3-hour study session with three topics (60-minute minimum per topic) and subtasks
  INSERT INTO sessions (id, roadmap_id, planned_minutes, started_at, created_at) VALUES
    (sess, r1, 180, now() - interval '30 minutes', now() - interval '35 minutes');

  INSERT INTO session_topics (id, session_id, topic_id, allocated_minutes, is_covered) VALUES
    (st1, sess, t_dot, 60, false),
    (st2, sess, t_inverse, 60, false),
    (st3, sess, t_broadcast, 60, false);

  INSERT INTO subtasks (session_topic_id, description, is_done, resource_title, resource_url, "order") VALUES
    (st1, 'Watch the dot product and duality chapter', true, 'Essence of Linear Algebra (3Blue1Brown)', 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab', 0),
    (st1, 'Project a 2D vector onto another by hand, then check in NumPy', false, NULL, NULL, 1),
    (st1, 'Write one sentence on why cosine similarity uses the dot product', false, NULL, NULL, 2),
    (st2, 'Work through the lecture on inverses and A = LU', false, 'MIT 18.06 Linear Algebra (OpenCourseWare)', 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/', 0),
    (st2, 'Invert a 3x3 matrix with Gauss-Jordan on paper', false, NULL, NULL, 1),
    (st3, 'Read the broadcasting section of the NumPy guide', true, 'NumPy: the absolute basics for beginners', 'https://numpy.org/doc/stable/user/absolute_beginners.html', 0),
    (st3, 'Rewrite a nested Python loop as one vectorised expression', false, NULL, NULL, 1);

  -- Flashcards
  INSERT INTO flashcards (topic_id, front, back, is_known, created_at) VALUES
    (t_vectors,  'What is the L2 norm of a vector v?', 'The square root of the sum of its squared components: ||v|| = sqrt(v1^2 + ... + vn^2).', true,  now() - interval '6 days'),
    (t_dot,      'What does a dot product of zero mean?', 'The two vectors are orthogonal (at 90 degrees to each other).', false, now() - interval '5 days'),
    (t_matrices, 'When can you multiply A (m x n) by B (p x q)?', 'Only when n = p. The result has shape m x q.', false, now() - interval '5 days'),
    (t_inverse,  'When does a square matrix have an inverse?', 'When its determinant is non-zero, i.e. its columns are linearly independent.', false, now() - interval '4 days'),
    (t_gauss,    'What is a pivot in Gaussian elimination?', 'The first non-zero entry in a row, used to eliminate entries below it.', true,  now() - interval '4 days'),
    (t_lintrans, 'What does the determinant of a 2x2 transformation tell you?', 'How much it scales area. A negative value means orientation is flipped.', false, now() - interval '3 days');

  -- A saved Feynman review
  INSERT INTO feynman_reviews (topic_id, explanation, score, feedback_solid, feedback_missing, topics_to_flag, created_at) VALUES
    (t_vectors,
     'A vector is a list of numbers that you can draw as an arrow from the origin. Adding vectors means putting arrows tip to tail. Multiplying by a number stretches the arrow.',
     7,
     'Clear geometric picture of addition and scaling.',
     'No mention of norms or how vectors represent data points in ML.',
     '["Dot Product and Projections"]',
     now() - interval '6 days');
END $$;
